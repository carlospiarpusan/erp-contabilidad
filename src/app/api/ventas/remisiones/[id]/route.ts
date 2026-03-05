import { NextRequest, NextResponse } from 'next/server'
import { getRemisionById, updateEstadoRemision } from '@/lib/db/remisiones'
import { createFactura } from '@/lib/db/ventas'
import { getEjercicioActivo, getEmpresaId } from '@/lib/db/maestros'

interface Params { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const data = await getRemisionById(id)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { accion, forma_pago_id, vencimiento } = await req.json()

    if (accion === 'enviar') {
      await updateEstadoRemision(id, 'enviada')
      return NextResponse.json({ ok: true })
    }

    if (accion === 'entregar') {
      await updateEstadoRemision(id, 'entregada')
      return NextResponse.json({ ok: true })
    }

    if (accion === 'cancelar') {
      await updateEstadoRemision(id, 'cancelada')
      return NextResponse.json({ ok: true })
    }

    if (accion === 'facturar') {
      // Convertir remisión a factura de venta
      const rem = await getRemisionById(id)
      if (!rem) return NextResponse.json({ error: 'Remisión no encontrada' }, { status: 404 })
      if (!forma_pago_id) return NextResponse.json({ error: 'forma_pago_id requerido' }, { status: 400 })

      const lineas = (rem as any).lineas ?? []
      const [empresa_id, ejercicio_id] = await Promise.all([getEmpresaId(), getEjercicioActivo()])
      const cliente = (rem as any).cliente as { id?: string } | null

      const facturaId = await createFactura({
        empresa_id, ejercicio_id,
        cliente_id: cliente?.id ?? (rem as any).cliente_id,
        bodega_id:  (rem as any).bodega_id,
        forma_pago_id,
        colaborador_id: null,
        fecha: new Date().toISOString().split('T')[0],
        fecha_vencimiento: vencimiento ?? new Date().toISOString().split('T')[0],
        observaciones: (rem as any).observaciones ?? null,
        lineas: lineas.map((l: any) => ({
          producto_id: l.producto_id,
          variante_id: null,
          impuesto_id: l.impuesto_id ?? null,
          descripcion: l.descripcion ?? '',
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          descuento_porcentaje: l.descuento_porcentaje ?? 0,
        })),
      })

      await updateEstadoRemision(id, 'facturada')
      return NextResponse.json({ id: facturaId })
    }

    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
