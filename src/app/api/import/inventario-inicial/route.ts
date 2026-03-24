import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { registrarAuditoria } from '@/lib/auditoria'
import { revalidateInventoryDependentViews } from '@/lib/cache/revalidate-inventory'

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

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'inventario', 'manage') && !puedeAcceder(session.rol, 'configuracion', 'manage')) {
      return NextResponse.json({ error: 'Sin permisos para importar inventario' }, { status: 403 })
    }

    const { filas } = await req.json()
    if (!Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: 'No se recibieron filas' }, { status: 400 })
    }

    const [supabase, empresa_id] = await Promise.all([createClient(), getEmpresaId()])

    const codigos = filas
      .map((fila) => String((fila as Record<string, string>).codigo ?? '').trim())
      .filter(Boolean)

    const repeatedCodes = codigos.filter((codigo, index) => codigos.indexOf(codigo) !== index)
    if (repeatedCodes.length > 0) {
      return NextResponse.json(
        { error: `Hay códigos repetidos en el archivo: ${[...new Set(repeatedCodes)].join(', ')}` },
        { status: 400 }
      )
    }

    const [{ data: productos, error: productosError }, { data: principal }, { data: primera }] = await Promise.all([
      supabase
        .from('productos')
        .select('id, codigo')
        .eq('empresa_id', empresa_id)
        .in('codigo', codigos),
      supabase
        .from('bodegas')
        .select('id')
        .eq('empresa_id', empresa_id)
        .eq('principal', true)
        .maybeSingle(),
      supabase
        .from('bodegas')
        .select('id')
        .eq('empresa_id', empresa_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

    if (productosError) throw productosError

    const bodegaId = principal?.id ?? primera?.id ?? null
    if (!bodegaId) {
      return NextResponse.json({ error: 'No existe una bodega configurada para cargar inventario inicial' }, { status: 400 })
    }

    const productosMap = new Map((productos ?? []).map((producto) => [String(producto.codigo), String(producto.id)]))

    const resultados = await Promise.all(filas.map(async (fila: Record<string, string>, index: number) => {
      const codigo = String(fila.codigo ?? '').trim()
      const productoId = productosMap.get(codigo)
      if (!codigo) {
        return { fila: index + 2, estado: 'error' as const, mensaje: 'codigo es requerido' }
      }
      if (!productoId) {
        return { fila: index + 2, estado: 'error' as const, mensaje: `El producto ${codigo} no existe` }
      }

      const stockActual = parseNumber(fila.stock_actual ?? fila.stock_inicial)
      const stockMinimoRaw = readCell(fila, 'stock_minimo', 'cantidad_minima', 'minimo', 'stock_min')
      const stockMinimo = hasValue(stockMinimoRaw) ? parseNumber(stockMinimoRaw) : null
      const precioCompraRaw = String(fila.precio_compra ?? '').trim()
      const precioCompra = precioCompraRaw ? parseNumber(precioCompraRaw) : null

      if (!Number.isFinite(stockActual) || stockActual < 0) {
        return { fila: index + 2, estado: 'error' as const, mensaje: 'stock_actual inválido' }
      }
      if (stockMinimo !== null && (!Number.isFinite(stockMinimo) || stockMinimo < 0)) {
        return { fila: index + 2, estado: 'error' as const, mensaje: 'stock_minimo inválido' }
      }
      if (precioCompra !== null && (!Number.isFinite(precioCompra) || precioCompra < 0)) {
        return { fila: index + 2, estado: 'error' as const, mensaje: 'precio_compra inválido' }
      }

      const { data: stockExistente, error: stockFetchError } = await supabase
        .from('stock')
        .select('id')
        .eq('producto_id', productoId)
        .eq('bodega_id', bodegaId)
        .is('variante_id', null)
        .maybeSingle()

      if (stockFetchError) {
        return { fila: index + 2, estado: 'error' as const, mensaje: stockFetchError.message }
      }

      if (stockExistente?.id) {
        const payload: { cantidad: number; cantidad_minima?: number } = { cantidad: stockActual }
        if (stockMinimo !== null) payload.cantidad_minima = stockMinimo
        const { error: stockError } = await supabase
          .from('stock')
          .update(payload)
          .eq('id', stockExistente.id)
        if (stockError) {
          return { fila: index + 2, estado: 'error' as const, mensaje: stockError.message }
        }
      } else {
        const { error: stockError } = await supabase
          .from('stock')
          .insert({
            producto_id: productoId,
            variante_id: null,
            bodega_id: bodegaId,
            cantidad: stockActual,
            cantidad_minima: stockMinimo ?? 0,
          })
        if (stockError) {
          return { fila: index + 2, estado: 'error' as const, mensaje: stockError.message }
        }
      }

      if (precioCompra !== null) {
        const { error: productoError } = await supabase
          .from('productos')
          .update({ precio_compra: precioCompra })
          .eq('id', productoId)
        if (productoError) {
          return { fila: index + 2, estado: 'error' as const, mensaje: productoError.message }
        }
      }

      return { fila: index + 2, estado: 'ok' as const }
    }))

    await registrarAuditoria({
      empresa_id: session.empresa_id,
      usuario_id: session.id,
      tabla: 'import_inventario_inicial',
      accion: 'INSERT',
      datos_nuevos: {
        entidad: 'inventario-inicial',
        total: filas.length,
        exitosos: resultados.filter((item) => item.estado === 'ok').length,
        fallidos: resultados.filter((item) => item.estado === 'error').length,
        detalle: 'Carga de inventario inicial sobre productos existentes en la bodega principal.',
      },
      ip: req.headers.get('x-forwarded-for'),
    })

    revalidateInventoryDependentViews(session.empresa_id)
    return NextResponse.json({ resultados })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
