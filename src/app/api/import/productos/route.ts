import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { registrarAuditoria } from '@/lib/auditoria'

function parseNumber(value: unknown) {
  const parsed = parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function readCell(fila: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = fila[key]
    if (value !== undefined) return value
  }
  return undefined
}

function hasValue(value: unknown) {
  return String(value ?? '').trim() !== ''
}

function parseBoolean(value: unknown, fallback = true) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return fallback
  if (['1', 'si', 'sí', 'true', 'activo'].includes(normalized)) return true
  if (['0', 'no', 'false', 'inactivo'].includes(normalized)) return false
  return fallback
}

function normalizeKey(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function parseTaxKey(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/%/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'configuracion', 'manage')) {
      return NextResponse.json({ error: 'Sin permisos para importar datos' }, { status: 403 })
    }
    const { filas } = await req.json()
    if (!Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: 'No se recibieron filas' }, { status: 400 })
    }

    const [supabase, empresa_id] = await Promise.all([createClient(), getEmpresaId()])

    const codigos = [...new Set(
      filas
        .map((fila) => String((fila as Record<string, string>).codigo ?? '').trim())
        .filter(Boolean)
    )]

    const [existingProductsRes, familiasRes, impuestosRes] = await Promise.all([
      codigos.length > 0
        ? supabase
          .from('productos')
          .select('id, codigo, codigo_barras, precio_venta, precio_venta2, precio_compra, impuesto_id, familia_id, unidad_medida, activo')
          .eq('empresa_id', empresa_id)
          .in('codigo', codigos)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('familias')
        .select('id, nombre, descripcion')
        .eq('empresa_id', empresa_id),
      supabase
        .from('impuestos')
        .select('id, codigo, descripcion, porcentaje')
        .eq('empresa_id', empresa_id),
    ])

    if (existingProductsRes.error) throw existingProductsRes.error
    if (familiasRes.error) throw familiasRes.error
    if (impuestosRes.error) throw impuestosRes.error

    const existingProducts = new Map(
      (existingProductsRes.data ?? []).map((producto) => [String(producto.codigo), producto])
    )
    const familias = new Map<string, string>()
    for (const familia of familiasRes.data ?? []) {
      familias.set(normalizeKey(familia.nombre), String(familia.id))
      if (familia.descripcion) {
        familias.set(normalizeKey(familia.descripcion), String(familia.id))
      }
    }
    const impuestosByKey = new Map<string, string>()
    for (const impuesto of impuestosRes.data ?? []) {
      if (impuesto.codigo) {
        impuestosByKey.set(parseTaxKey(impuesto.codigo), String(impuesto.id))
      }
      if (impuesto.descripcion) {
        impuestosByKey.set(parseTaxKey(impuesto.descripcion), String(impuesto.id))
      }
      if (impuesto.porcentaje !== null && impuesto.porcentaje !== undefined) {
        const porcentaje = String(Number(impuesto.porcentaje))
        impuestosByKey.set(parseTaxKey(porcentaje), String(impuesto.id))
      }
    }

    const { data: principal } = await supabase
      .from('bodegas')
      .select('id')
      .eq('empresa_id', empresa_id)
      .eq('principal', true)
      .maybeSingle()

    let bodegaId = principal?.id ?? null
    if (!bodegaId) {
      const { data: primera } = await supabase
        .from('bodegas')
        .select('id')
        .eq('empresa_id', empresa_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (primera?.id) {
        bodegaId = primera.id
      } else {
        const codigo = `BOD-${String(Date.now()).slice(-6)}`
        const { data: creada, error: bodegaErr } = await supabase
          .from('bodegas')
          .insert({ empresa_id, codigo, nombre: 'Bodega Principal', principal: true, activa: true })
          .select('id')
          .single()
        if (bodegaErr) throw bodegaErr
        bodegaId = creada.id
      }
    }

    const resultados = await Promise.all(filas.map(async (f: Record<string, string>, i: number) => {
      const codigo      = f.codigo?.trim()
      const descripcion = f.descripcion?.trim()
      const existing = existingProducts.get(codigo ?? '')
      const precioVentaRaw = String(f.precio_venta ?? '').trim()

      if (!codigo || !descripcion) {
        return { fila: i + 2, estado: 'error', mensaje: 'codigo y descripcion son requeridos' }
      }
      const precio_venta = precioVentaRaw
        ? parseNumber(precioVentaRaw)
        : Number(existing?.precio_venta ?? Number.NaN)

      if (!Number.isFinite(precio_venta) || precio_venta < 0) {
        return { fila: i + 2, estado: 'error', mensaje: 'precio_venta inválido' }
      }

      const precioCompraRaw = String(f.precio_compra ?? '').trim()
      const precio_compra = precioCompraRaw
        ? parseNumber(precioCompraRaw)
        : Number(existing?.precio_compra ?? 0)
      const precioVenta2Raw = String(f.precio_venta2 ?? '').trim()
      const precio_venta2 = precioVenta2Raw
        ? parseNumber(precioVenta2Raw)
        : (existing?.precio_venta2 ?? null)
      const stockActualRaw = readCell(f, 'stock_actual', 'stock_inicial')
      const stockMinimoRaw = readCell(f, 'stock_minimo', 'cantidad_minima', 'minimo', 'stock_min')
      const stock_actual = hasValue(stockActualRaw) ? parseNumber(stockActualRaw) : null
      const stock_minimo = hasValue(stockMinimoRaw) ? parseNumber(stockMinimoRaw) : null
      const unidad_medida = f.unidad_medida?.trim() || f.unidad?.trim() || existing?.unidad_medida || 'UND'
      const codigoBarrasRaw = f.codigo_barras?.trim()
      const codigo_barras = codigoBarrasRaw ? codigoBarrasRaw : (existing?.codigo_barras ?? null)
      const familiaTexto = f.familia?.trim()
      const familia_id = familiaTexto
        ? familias.get(normalizeKey(familiaTexto)) ?? null
        : (existing?.familia_id ?? null)
      const impuestoTexto = String(f.impuesto ?? f.iva ?? '').trim()
      const impuestoKey = parseTaxKey(impuestoTexto)
      let impuesto_id = existing?.impuesto_id ?? null
      if (impuestoTexto) {
        if (['0', '0.0', '0.00', 'sin iva', 'sin_iva', 'no aplica', 'no_aplica'].includes(impuestoKey)) {
          impuesto_id = null
        } else {
          impuesto_id = impuestosByKey.get(impuestoKey) ?? null
          if (!impuesto_id) {
            return { fila: i + 2, estado: 'error', mensaje: `El impuesto "${impuestoTexto}" no existe` }
          }
        }
      }
      const activo = parseBoolean(f.activo, existing ? Boolean(existing.activo) : true)

      if (familiaTexto && !familia_id) {
        return { fila: i + 2, estado: 'error', mensaje: `La familia "${familiaTexto}" no existe` }
      }
      if (precio_venta2 !== null && (!Number.isFinite(precio_venta2) || precio_venta2 < 0)) {
        return { fila: i + 2, estado: 'error', mensaje: 'precio_venta2 inválido' }
      }
      if (stock_actual !== null && (!Number.isFinite(stock_actual) || stock_actual < 0)) {
        return { fila: i + 2, estado: 'error', mensaje: 'stock_actual inválido' }
      }
      if (stock_minimo !== null && (!Number.isFinite(stock_minimo) || stock_minimo < 0)) {
        return { fila: i + 2, estado: 'error', mensaje: 'stock_minimo inválido' }
      }

      const payload = {
        empresa_id,
        codigo,
        codigo_barras,
        descripcion,
        precio_venta,
        precio_venta2,
        precio_compra,
        impuesto_id,
        familia_id,
        unidad_medida,
        activo,
      }

      const { data: producto, error } = await supabase
        .from('productos')
        .upsert(payload, { onConflict: 'empresa_id,codigo' })
        .select('id')
        .single()

      if (error) return { fila: i + 2, estado: 'error', mensaje: error.message }
      existingProducts.set(codigo, {
        id: producto.id,
        codigo,
        codigo_barras,
        precio_venta,
        precio_venta2,
        precio_compra,
        impuesto_id,
        familia_id,
        unidad_medida,
        activo,
      })

      const tieneCamposStock = stock_actual !== null || stock_minimo !== null
      if (bodegaId && producto?.id && tieneCamposStock) {
        const { data: stockExistente } = await supabase
          .from('stock')
          .select('id')
          .eq('producto_id', producto.id)
          .eq('bodega_id', bodegaId)
          .is('variante_id', null)
          .maybeSingle()

        if (stockExistente?.id) {
          const payload: { cantidad?: number; cantidad_minima?: number } = {}
          if (stock_actual !== null) payload.cantidad = stock_actual
          if (stock_minimo !== null) payload.cantidad_minima = stock_minimo
          const { error: stockErr } = await supabase
            .from('stock')
            .update(payload)
            .eq('id', stockExistente.id)
          if (stockErr) return { fila: i + 2, estado: 'error', mensaje: stockErr.message }
        } else {
          const { error: stockErr } = await supabase
            .from('stock')
            .insert({
              producto_id: producto.id,
              variante_id: null,
              bodega_id: bodegaId,
              cantidad: stock_actual ?? 0,
              cantidad_minima: stock_minimo ?? 0,
            })
          if (stockErr) return { fila: i + 2, estado: 'error', mensaje: stockErr.message }
        }
      }

      return { fila: i + 2, estado: 'ok' }
    }))

    await registrarAuditoria({
      empresa_id: session.empresa_id,
      usuario_id: session.id,
      tabla: 'import_productos',
      accion: 'INSERT',
      datos_nuevos: {
        entidad: 'productos',
        total: filas.length,
        exitosos: resultados.filter((item) => item.estado === 'ok').length,
        fallidos: resultados.filter((item) => item.estado === 'error').length,
        detalle: 'Migracion de catalogo, precios y stock inicial desde configuracion.',
      },
      ip: req.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ resultados })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
