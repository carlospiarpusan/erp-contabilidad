import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEjercicioActivo } from '@/lib/db/maestros'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidateInventoryDependentViews } from '@/lib/cache/revalidate-inventory'

type LineaConfirmada = {
  descripcion: string
  codigo_proveedor: string
  gtin?: string | null
  standard_scheme_id?: string | null
  standard_scheme_name?: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
  iva: number
  total: number
  porcentaje_iva?: number
  accion: 'usar_existente' | 'crear_nuevo'
  producto_id?: string | null
  nuevo_codigo?: string
  nueva_descripcion?: string
  nuevo_precio_venta?: number
  persistir_gtin?: boolean
  crear_equivalencia?: boolean
}

type ProductoBase = {
  id: string
  codigo: string
  codigo_barras: string | null
  descripcion: string
  precio_compra: number | null
  precio_venta: number | null
  impuesto_id: string | null
}

type ImpuestoDisponible = {
  id: string
  porcentaje: number | null
}

function normalizeCode(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase()
}

function normalizeDigits(value: string | null | undefined) {
  return (value ?? '').replace(/[^0-9]/g, '')
}

function normalizeText(value: string | null | undefined) {
  const trimmed = (value ?? '').trim()
  return trimmed || null
}

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

function isValidDateRange(fecha: string, inicio: string, fin: string) {
  return fecha >= inicio && fecha <= fin
}

function isMissingImportRpc(error: unknown) {
  if (typeof error !== 'object' || error === null) return false
  const code = String((error as { code?: string }).code ?? '')
  const message = String((error as { message?: string }).message ?? '')
  return code === 'PGRST202' || code === '42883' || message.includes('secure_importar_factura_electronica_compra')
}

function getErrorStatus(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code?: string }).code ?? '')
    if (code === 'P0001' || code.startsWith('23')) return 400
  }
  return 500
}

function buildObservaciones(base: string | undefined, fechaOriginal: string | undefined, numeroExterno: string) {
  const lines = [normalizeText(base)]

  if (fechaOriginal) {
    lines.push(`Importada desde factura electronica XML/ZIP/PDF. Fecha original DIAN: ${fechaOriginal}. Numero externo: ${numeroExterno}.`)
  } else {
    lines.push(`Importada desde factura electronica XML/ZIP/PDF. Numero externo: ${numeroExterno}.`)
  }

  return lines.filter(Boolean).join('\n')
}

function resolveImpuestoId(impuestos: ImpuestoDisponible[], porcentajeIva?: number) {
  const porcentaje = Number(porcentajeIva ?? 0)
  const exact = impuestos.find((item) => Number(item.porcentaje ?? 0) === porcentaje)
  if (exact) return exact.id
  if (porcentaje === 0) return null
  throw new Error(`No existe un impuesto configurado para IVA ${porcentaje}% en la empresa`)
}

async function persistProviderMappingsIfAvailable(params: {
  admin: ReturnType<typeof createServiceClient>
  empresaId: string
  proveedorId: string
  lineas: Array<{
    producto_id: string
    codigo_proveedor: string | null
    gtin: string | null
    descripcion: string
    crear_equivalencia: boolean
  }>
}) {
  const rows = params.lineas
    .filter((linea) => linea.crear_equivalencia && (linea.codigo_proveedor || linea.gtin))
    .map((linea) => ({
      empresa_id: params.empresaId,
      proveedor_id: params.proveedorId,
      producto_id: linea.producto_id,
      codigo_proveedor: linea.codigo_proveedor,
      gtin: linea.gtin,
      descripcion_proveedor: linea.descripcion,
    }))

  if (!rows.length) return

  try {
    const { error } = await params.admin
      .from('productos_codigos_proveedor')
      .insert(rows)

    if (!error) return
    if (error.code === 'PGRST205') return
    if (error.code?.startsWith('23')) return
    throw error
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = String((error as { code?: string }).code ?? '')
      if (code === 'PGRST205' || code.startsWith('23')) return
    }
    throw error
  }
}

async function confirmWithFallback(params: {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
  proveedor_id: string
  bodega_id: string
  fecha_contabilizacion: string
  fecha_original?: string
  numero_externo: string
  observaciones?: string
  lineas: LineaConfirmada[]
  ejercicio: { id: string; fecha_inicio: string | Date; fecha_fin: string | Date }
}) {
  const admin = createServiceClient()
  const supabase = await createClient()
  const empresaId = params.session.empresa_id
  const numeroExterno = params.numero_externo.trim()

  const lineasConProducto = params.lineas.filter((linea) => linea.accion === 'usar_existente' && linea.producto_id)
  const lineasNuevas = params.lineas.filter((linea) => linea.accion === 'crear_nuevo')
  const existingProductIds = [...new Set(lineasConProducto.map((linea) => linea.producto_id!))]
  const requestedBarcodes = [...new Set(params.lineas.map((linea) => normalizeDigits(linea.gtin)).filter(Boolean))]
  const requestedCodes = [...new Set(lineasNuevas.map((linea) => normalizeCode(linea.nuevo_codigo)).filter(Boolean))]

  const [
    proveedorRes,
    bodegaRes,
    productosExistentesRes,
    impuestosRes,
    barcodeRes,
    codeRes,
    duplicateDocRes,
  ] = await Promise.all([
    admin
      .from('proveedores')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('id', params.proveedor_id)
      .maybeSingle(),
    admin
      .from('bodegas')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('id', params.bodega_id)
      .maybeSingle(),
    existingProductIds.length
      ? admin
        .from('productos')
        .select('id, codigo, codigo_barras, descripcion, precio_compra, precio_venta, impuesto_id')
        .eq('empresa_id', empresaId)
        .in('id', existingProductIds)
      : Promise.resolve({ data: [] as ProductoBase[], error: null }),
    admin
      .from('impuestos')
      .select('id, porcentaje')
      .eq('empresa_id', empresaId),
    requestedBarcodes.length
      ? admin
        .from('productos')
        .select('id, codigo, codigo_barras')
        .eq('empresa_id', empresaId)
        .in('codigo_barras', requestedBarcodes)
      : Promise.resolve({ data: [] as Array<Pick<ProductoBase, 'id' | 'codigo' | 'codigo_barras'>>, error: null }),
    requestedCodes.length
      ? admin
        .from('productos')
        .select('id, codigo')
        .eq('empresa_id', empresaId)
        .in('codigo', requestedCodes)
      : Promise.resolve({ data: [] as Array<Pick<ProductoBase, 'id' | 'codigo'>>, error: null }),
    admin
      .from('documentos')
      .select('id, numero_externo')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'factura_compra')
      .eq('proveedor_id', params.proveedor_id)
      .ilike('numero_externo', numeroExterno)
      .limit(1),
  ])

  if (proveedorRes.error) throw proveedorRes.error
  if (bodegaRes.error) throw bodegaRes.error
  if (productosExistentesRes.error) throw productosExistentesRes.error
  if (impuestosRes.error) throw impuestosRes.error
  if (barcodeRes.error) throw barcodeRes.error
  if (codeRes.error) throw codeRes.error
  if (duplicateDocRes.error) throw duplicateDocRes.error

  if (!proveedorRes.data) {
    throw new Error('Proveedor fuera de la empresa')
  }
  if (!bodegaRes.data) {
    throw new Error('Bodega fuera de la empresa')
  }
  if ((duplicateDocRes.data ?? []).some((item) => item.numero_externo?.trim().toLowerCase() === numeroExterno.toLowerCase())) {
    throw new Error(`Ya existe una factura de compra para ese proveedor con numero_externo ${numeroExterno}`)
  }

  const impuestos = (impuestosRes.data ?? []) as ImpuestoDisponible[]
  const existingProducts = new Map(
    ((productosExistentesRes.data ?? []) as ProductoBase[]).map((producto) => [producto.id, producto])
  )

  if (existingProducts.size !== existingProductIds.length) {
    throw new Error('Una o mas lineas apuntan a productos fuera de la empresa')
  }

  const barcodeOwners = new Map(
    ((barcodeRes.data ?? []) as Array<Pick<ProductoBase, 'id' | 'codigo' | 'codigo_barras'>>)
      .filter((item) => item.codigo_barras)
      .map((item) => [normalizeDigits(item.codigo_barras), item])
  )
  const codeOwners = new Map(
    ((codeRes.data ?? []) as Array<Pick<ProductoBase, 'id' | 'codigo'>>)
      .map((item) => [normalizeCode(item.codigo), item])
  )

  const createdProductIds: string[] = []
  const createdProductsByCode = new Map<string, ProductoBase>()
  const pendingProductUpdates: Array<{ id: string; patch: Partial<ProductoBase> }> = []
  const lineasCompra: Array<{
    producto_id: string
    descripcion: string
    cantidad: number
    precio_unitario: number
    descuento_porcentaje: number
    impuesto_id: string | null
  }> = []
  const mappingsToPersist: Array<{
    producto_id: string
    codigo_proveedor: string | null
    gtin: string | null
    descripcion: string
    crear_equivalencia: boolean
  }> = []

  try {
    for (const linea of params.lineas) {
      const cantidad = Number(linea.cantidad)
      const precioUnitario = roundMoney(Number(linea.precio_unitario))
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new Error(`Cantidad invalida en la linea "${linea.descripcion}"`)
      }
      if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
        throw new Error(`Precio invalido en la linea "${linea.descripcion}"`)
      }

      const impuestoId = resolveImpuestoId(impuestos, linea.porcentaje_iva)
      const codigoProveedor = normalizeCode(linea.codigo_proveedor)
      const gtin = normalizeDigits(linea.gtin) || null

      if (linea.accion === 'usar_existente') {
        const producto = existingProducts.get(linea.producto_id!)
        if (!producto) {
          throw new Error(`Producto no encontrado para la linea "${linea.descripcion}"`)
        }

        const patch: Partial<ProductoBase> = {
          precio_compra: precioUnitario,
          impuesto_id: impuestoId,
        }

        if (linea.persistir_gtin && gtin) {
          const owner = barcodeOwners.get(gtin)
          if (owner && owner.id !== producto.id) {
            throw new Error(`El GTIN ${gtin} ya pertenece al producto ${owner.codigo}`)
          }
          if (!normalizeDigits(producto.codigo_barras)) {
            patch.codigo_barras = gtin
          } else if (normalizeDigits(producto.codigo_barras) !== gtin) {
            throw new Error(`El producto ${producto.codigo} ya tiene un codigo de barras distinto al GTIN ${gtin}`)
          }
        }

        pendingProductUpdates.push({ id: producto.id, patch })
        lineasCompra.push({
          producto_id: producto.id,
          descripcion: normalizeText(linea.descripcion) ?? producto.descripcion,
          cantidad,
          precio_unitario: precioUnitario,
          descuento_porcentaje: 0,
          impuesto_id: impuestoId,
        })
        mappingsToPersist.push({
          producto_id: producto.id,
          codigo_proveedor: codigoProveedor || null,
          gtin,
          descripcion: linea.descripcion,
          crear_equivalencia: Boolean(linea.crear_equivalencia),
        })
        continue
      }

      const nuevoCodigo = normalizeCode(linea.nuevo_codigo)
      if (!nuevoCodigo) {
        throw new Error(`La linea "${linea.descripcion}" requiere nuevo_codigo`)
      }
      const createdInRequest = createdProductsByCode.get(nuevoCodigo)
      if (!createdInRequest && codeOwners.has(nuevoCodigo)) {
        throw new Error(`Ya existe un producto con codigo ${nuevoCodigo}`)
      }

      if (linea.persistir_gtin && gtin) {
        const owner = barcodeOwners.get(gtin)
        if (owner && owner.id !== createdInRequest?.id) {
          throw new Error(`El GTIN ${gtin} ya pertenece al producto ${owner.codigo}`)
        }
      }

      if (createdInRequest) {
        if (linea.persistir_gtin && gtin && !normalizeDigits(createdInRequest.codigo_barras)) {
          const { error: updateCreatedError } = await admin
            .from('productos')
            .update({ codigo_barras: gtin, updated_at: new Date().toISOString() })
            .eq('empresa_id', empresaId)
            .eq('id', createdInRequest.id)

          if (updateCreatedError) throw updateCreatedError
          createdInRequest.codigo_barras = gtin
          barcodeOwners.set(gtin, {
            id: createdInRequest.id,
            codigo: createdInRequest.codigo,
            codigo_barras: gtin,
          })
        }

        lineasCompra.push({
          producto_id: createdInRequest.id,
          descripcion: normalizeText(linea.descripcion) ?? createdInRequest.descripcion,
          cantidad,
          precio_unitario: precioUnitario,
          descuento_porcentaje: 0,
          impuesto_id: impuestoId,
        })
        mappingsToPersist.push({
          producto_id: createdInRequest.id,
          codigo_proveedor: codigoProveedor || null,
          gtin,
          descripcion: linea.descripcion,
          crear_equivalencia: Boolean(linea.crear_equivalencia),
        })
        continue
      }

      const { data: createdProduct, error: createError } = await admin
        .from('productos')
        .insert({
          empresa_id: empresaId,
          codigo: nuevoCodigo,
          codigo_barras: linea.persistir_gtin && gtin ? gtin : null,
          descripcion: normalizeText(linea.nueva_descripcion) ?? normalizeText(linea.descripcion) ?? nuevoCodigo,
          descripcion_larga: normalizeText(linea.descripcion),
          precio_venta: roundMoney(Number(linea.nuevo_precio_venta ?? 0)),
          precio_compra: precioUnitario,
          precio_venta2: null,
          tiene_variantes: false,
          familia_id: null,
          fabricante_id: null,
          impuesto_id: impuestoId,
          cuenta_venta_id: null,
          cuenta_compra_id: null,
          cuenta_inventario_id: null,
          imagen_url: null,
          tiene_vencimiento: false,
          unidad_medida: 'UND',
          peso_gramos: null,
          activo: true,
        })
        .select('id, codigo, codigo_barras, descripcion, precio_compra, precio_venta, impuesto_id')
        .single()

      if (createError) throw createError

      createdProductIds.push(createdProduct.id)
      createdProductsByCode.set(nuevoCodigo, createdProduct)
      codeOwners.set(nuevoCodigo, { id: createdProduct.id, codigo: nuevoCodigo })
      if (createdProduct.codigo_barras) {
        barcodeOwners.set(normalizeDigits(createdProduct.codigo_barras), {
          id: createdProduct.id,
          codigo: createdProduct.codigo,
          codigo_barras: createdProduct.codigo_barras,
        })
      }

      lineasCompra.push({
        producto_id: createdProduct.id,
        descripcion: normalizeText(linea.descripcion) ?? createdProduct.descripcion,
        cantidad,
        precio_unitario: precioUnitario,
        descuento_porcentaje: 0,
        impuesto_id: impuestoId,
      })
      mappingsToPersist.push({
        producto_id: createdProduct.id,
        codigo_proveedor: codigoProveedor || null,
        gtin,
        descripcion: linea.descripcion,
        crear_equivalencia: Boolean(linea.crear_equivalencia),
      })
    }

    const { data: documentoId, error: createDocError } = await supabase.rpc('secure_crear_factura_compra', {
      p_ejercicio_id: params.ejercicio.id,
      p_proveedor_id: params.proveedor_id,
      p_bodega_id: params.bodega_id,
      p_fecha: params.fecha_contabilizacion,
      p_numero_externo: numeroExterno,
      p_observaciones: buildObservaciones(params.observaciones, params.fecha_original, numeroExterno),
      p_lineas: lineasCompra,
    })

    if (createDocError) throw createDocError

    for (const update of pendingProductUpdates) {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (update.patch.precio_compra != null) patch.precio_compra = update.patch.precio_compra
      if (update.patch.impuesto_id !== undefined) patch.impuesto_id = update.patch.impuesto_id
      if (update.patch.codigo_barras !== undefined) patch.codigo_barras = update.patch.codigo_barras

      const { error: updateError } = await admin
        .from('productos')
        .update(patch)
        .eq('empresa_id', empresaId)
        .eq('id', update.id)

      if (updateError) throw updateError
    }

    await persistProviderMappingsIfAvailable({
      admin,
      empresaId,
      proveedorId: params.proveedor_id,
      lineas: mappingsToPersist,
    })

    return documentoId as string
  } catch (error) {
    if (createdProductIds.length) {
      await admin
        .from('productos')
        .delete()
        .eq('empresa_id', empresaId)
        .in('id', createdProductIds)
    }
    throw error
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!puedeAcceder(session.rol, 'compras', 'manage')) {
      return NextResponse.json({ error: 'Sin permisos para importar compras' }, { status: 403 })
    }

    const body = await req.json()
    const {
      proveedor_id,
      bodega_id,
      fecha_contabilizacion,
      fecha_original,
      numero_externo,
      observaciones,
      lineas,
    }: {
      proveedor_id: string
      bodega_id: string
      fecha_contabilizacion: string
      fecha_original?: string
      numero_externo: string
      observaciones?: string
      lineas: LineaConfirmada[]
    } = body

    if (!proveedor_id) {
      return NextResponse.json({ error: 'proveedor_id requerido' }, { status: 400 })
    }
    if (!bodega_id) {
      return NextResponse.json({ error: 'bodega_id requerido' }, { status: 400 })
    }
    if (!numero_externo) {
      return NextResponse.json({ error: 'numero_externo requerido' }, { status: 400 })
    }
    if (!fecha_contabilizacion) {
      return NextResponse.json({ error: 'fecha_contabilizacion requerida' }, { status: 400 })
    }
    if (!lineas?.length) {
      return NextResponse.json({ error: 'Se requiere al menos una linea' }, { status: 400 })
    }

    const ejercicio = await getEjercicioActivo()
    if (!ejercicio) {
      return NextResponse.json({ error: 'Sin ejercicio contable activo' }, { status: 400 })
    }

    if (!isValidDateRange(fecha_contabilizacion, String(ejercicio.fecha_inicio), String(ejercicio.fecha_fin))) {
      return NextResponse.json({
        error: `La fecha ${fecha_contabilizacion} esta fuera del ejercicio activo (${ejercicio.fecha_inicio} a ${ejercicio.fecha_fin})`,
      }, { status: 400 })
    }

    for (const linea of lineas) {
      if (linea.accion !== 'usar_existente' && linea.accion !== 'crear_nuevo') {
        return NextResponse.json({ error: 'Todas las lineas deben quedar resueltas antes de importar' }, { status: 400 })
      }
      if (linea.accion === 'usar_existente' && !linea.producto_id) {
        return NextResponse.json({ error: `La linea "${linea.descripcion}" requiere producto_id` }, { status: 400 })
      }
      if (linea.accion === 'crear_nuevo' && !(linea.nuevo_codigo ?? '').trim()) {
        return NextResponse.json({ error: `La linea "${linea.descripcion}" requiere nuevo_codigo` }, { status: 400 })
      }
    }

    const supabase = await createClient()
    try {
      const { data, error } = await supabase.rpc('secure_importar_factura_electronica_compra', {
        p_ejercicio_id: ejercicio.id,
        p_proveedor_id: proveedor_id,
        p_bodega_id: bodega_id,
        p_fecha: fecha_contabilizacion,
        p_fecha_original: fecha_original || null,
        p_numero_externo: numero_externo,
        p_observaciones: observaciones || null,
        p_lineas: lineas.map((linea) => ({
          descripcion: linea.descripcion,
          codigo_proveedor: linea.codigo_proveedor || null,
          gtin: linea.gtin || null,
          standard_scheme_id: linea.standard_scheme_id || null,
          standard_scheme_name: linea.standard_scheme_name || null,
          cantidad: linea.cantidad,
          precio_unitario: linea.precio_unitario,
          subtotal: linea.subtotal,
          iva: linea.iva,
          total: linea.total,
          porcentaje_iva: linea.porcentaje_iva ?? 0,
          accion: linea.accion,
          producto_id: linea.producto_id || null,
          nuevo_codigo: linea.nuevo_codigo || null,
          nueva_descripcion: linea.nueva_descripcion || null,
          nuevo_precio_venta: linea.nuevo_precio_venta ?? null,
          persistir_gtin: linea.persistir_gtin ?? false,
          crear_equivalencia: linea.crear_equivalencia ?? false,
        })),
      })

      if (error) throw error

      revalidateInventoryDependentViews(session.empresa_id)
      return NextResponse.json({ ok: true, id: data })
    } catch (error) {
      if (!isMissingImportRpc(error)) throw error

      const id = await confirmWithFallback({
        session,
        proveedor_id,
        bodega_id,
        fecha_contabilizacion,
        fecha_original,
        numero_externo,
        observaciones,
        lineas,
        ejercicio,
      })

      revalidateInventoryDependentViews(session.empresa_id)
      return NextResponse.json({ ok: true, id, mode: 'fallback' })
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al confirmar importacion' },
      { status: getErrorStatus(error) }
    )
  }
}
