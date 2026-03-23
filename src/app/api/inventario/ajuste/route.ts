import { NextRequest, NextResponse } from 'next/server'
import { ajustarStock } from '@/lib/db/productos'
import { getSession } from '@/lib/auth/session'
import { z } from 'zod'
import { revalidateInventoryDependentViews } from '@/lib/cache/revalidate-inventory'

const ROLES_AJUSTE_STOCK = new Set(['admin', 'contador'])

const ajusteSchema = z.object({
  producto_id: z.string().uuid(),
  bodega_id: z.string().uuid(),
  tipo: z.enum(['ajuste_positivo', 'ajuste_negativo', 'entrada_compra', 'salida_venta', 'ajuste_inventario']),
  cantidad: z.number().positive(),
  notas: z.string().trim().max(500).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !ROLES_AJUSTE_STOCK.has(session.rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const rawBody = await req.json()
    const normalized = {
      ...rawBody,
      cantidad: Number(rawBody?.cantidad),
    }
    const parsed = ajusteSchema.safeParse(normalized)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Campos inválidos para ajuste de inventario' }, { status: 400 })
    }

    const { producto_id, bodega_id, tipo, cantidad, notas } = parsed.data
    await ajustarStock({ producto_id, bodega_id, tipo, cantidad: Number(cantidad), notas })
    revalidateInventoryDependentViews(session.empresa_id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
