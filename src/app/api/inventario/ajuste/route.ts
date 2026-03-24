import { NextRequest, NextResponse } from 'next/server'
import { ajustarStock } from '@/lib/db/productos'
import { getSession } from '@/lib/auth/session'
import { ensurePeriodoAbierto } from '@/lib/db/compliance'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { revalidateInventoryDependentViews } from '@/lib/cache/revalidate-inventory'
import { getTodayInAppTimeZone } from '@/lib/utils/dates'

const ROLES_AJUSTE_STOCK = new Set(['admin', 'contador'])

const ajusteSchema = z.object({
  producto_id: z.string().uuid(),
  bodega_id: z.string().uuid(),
  tipo: z.enum(['ajuste_positivo', 'ajuste_negativo', 'entrada_compra', 'salida_venta', 'ajuste_inventario']),
  cantidad: z.number().nonnegative().optional(),
  stock_objetivo: z.number().nonnegative().optional(),
  notas: z.string().trim().max(500).optional(),
}).superRefine((data, ctx) => {
  if (data.tipo === 'ajuste_inventario') {
    if (data.stock_objetivo == null || !Number.isFinite(data.stock_objetivo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stock_objetivo'],
        message: 'stock_objetivo requerido para ajuste de inventario',
      })
    }
    return
  }

  if (data.cantidad == null || !Number.isFinite(data.cantidad) || data.cantidad <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cantidad'],
      message: 'cantidad requerida para este tipo de ajuste',
    })
  }
})

function normalizeOptionalNumber(value: unknown) {
  if (value === '' || value == null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !ROLES_AJUSTE_STOCK.has(session.rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const supabase = await createClient()
    const rawBody = await req.json()
    const rawBodegaId = typeof rawBody?.bodega_id === 'string' ? rawBody.bodega_id.trim() : ''

    if (!rawBodegaId) {
      const { count, error: bodegasError } = await supabase
        .from('bodegas')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', session.empresa_id)
        .eq('activa', true)

      if (bodegasError) throw bodegasError

      return NextResponse.json({
        error: count
          ? 'Selecciona una bodega para aplicar el ajuste.'
          : 'No se puede realizar el ajuste porque la empresa no tiene bodegas configuradas.',
      }, { status: 400 })
    }

    const normalized = {
      ...rawBody,
      bodega_id: rawBodegaId,
      cantidad: normalizeOptionalNumber(rawBody?.cantidad),
      stock_objetivo: normalizeOptionalNumber(rawBody?.stock_objetivo),
    }
    const parsed = ajusteSchema.safeParse(normalized)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Campos inválidos para ajuste de inventario' }, { status: 400 })
    }

    const { producto_id, bodega_id, tipo, cantidad, stock_objetivo, notas } = parsed.data
    const { data: bodega, error: bodegaError } = await supabase
      .from('bodegas')
      .select('id, activa')
      .eq('empresa_id', session.empresa_id)
      .eq('id', bodega_id)
      .maybeSingle()

    if (bodegaError) throw bodegaError
    if (!bodega) {
      return NextResponse.json({ error: 'La bodega seleccionada no existe o no pertenece a la empresa.' }, { status: 400 })
    }
    if (bodega.activa === false) {
      return NextResponse.json({ error: 'La bodega seleccionada está inactiva. Actívala o elige otra bodega.' }, { status: 400 })
    }

    const fecha = getTodayInAppTimeZone()
    await ensurePeriodoAbierto({
      session,
      fecha,
      source: 'api:inventario-ajuste',
      method: req.method,
      route: '/api/inventario/ajuste',
      context: { tipo, producto_id, bodega_id },
    })
    const result = await ajustarStock({
      producto_id,
      bodega_id,
      tipo,
      cantidad: Number(cantidad ?? 0),
      stock_objetivo,
      notas,
    })
    revalidateInventoryDependentViews(session.empresa_id, { productoId: producto_id })
    return NextResponse.json({
      ok: true,
      applied: result?.mode !== 'noop',
      delta: result?.delta ?? 0,
      stock_actual: result?.stock_actual ?? null,
      stock_final: result?.stock_final ?? null,
      stock_objetivo: result?.stock_objetivo ?? null,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
