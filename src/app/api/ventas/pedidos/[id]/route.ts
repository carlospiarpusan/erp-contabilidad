import { NextRequest, NextResponse } from 'next/server'
import { getPedidoById, updateEstadoPedido } from '@/lib/db/pedidos'
import { createFactura } from '@/lib/db/ventas'
import { getEjercicioActivo, getEmpresaId } from '@/lib/db/maestros'
import { createClient } from '@/lib/supabase/server'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    return NextResponse.json(await getPedidoById(id))
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { accion, forma_pago_id, vencimiento } = await req.json()

    if (accion === 'cancelar') {
      await updateEstadoPedido(id, 'cancelado')
      return NextResponse.json({ ok: true })
    }

    if (accion === 'en_proceso') {
      await updateEstadoPedido(id, 'en_proceso')
      return NextResponse.json({ ok: true })
    }

    if (accion === 'despachar') {
      await updateEstadoPedido(id, 'despachado')
      return NextResponse.json({ ok: true })
    }

    if (accion === 'facturar') {
      const pedido = await getPedidoById(id)
      if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

      const lineas = (pedido.lineas ?? []) as unknown as {
        producto?: { id?: string } | null; impuesto?: { id?: string } | null
        descripcion?: string | null; cantidad: number; precio_unitario: number; descuento_porcentaje: number
      }[]

      const [empresa_id, ejercicio_id] = await Promise.all([getEmpresaId(), getEjercicioActivo()])
      const bodega = pedido.bodega as { id?: string } | null
      const hoy = new Date().toISOString().split('T')[0]

      const facturaId = await createFactura({
        empresa_id, ejercicio_id,
        cliente_id:        (pedido.cliente as { id?: string } | null)?.id ?? '',
        bodega_id:         bodega?.id ?? '',
        forma_pago_id:     forma_pago_id ?? '',
        colaborador_id:    null,
        fecha:             pedido.fecha as string,
        fecha_vencimiento: vencimiento ?? hoy,
        observaciones:     pedido.observaciones ?? null,
        lineas: lineas.map(l => ({
          producto_id:          (l.producto as { id?: string } | null)?.id ?? '',
          variante_id:          null,
          impuesto_id:          (l.impuesto as { id?: string } | null)?.id ?? null,
          descripcion:          l.descripcion ?? '',
          cantidad:             l.cantidad,
          precio_unitario:      l.precio_unitario,
          descuento_porcentaje: l.descuento_porcentaje,
        })),
      })

      const supabase = await createClient()
      await Promise.all([
        supabase.from('documentos').update({ estado: 'facturado', updated_at: new Date().toISOString() }).eq('id', id),
        supabase.from('documentos').update({ documento_origen_id: id }).eq('id', facturaId),
      ])

      return NextResponse.json({ id: facturaId })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
