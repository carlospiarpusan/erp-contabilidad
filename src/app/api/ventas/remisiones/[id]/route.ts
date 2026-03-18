import { NextRequest, NextResponse } from 'next/server'
import { getRemisionById, updateEstadoRemision } from '@/lib/db/remisiones'
import { createFactura } from '@/lib/db/ventas'
import { getEjercicioActivo, getEmpresaId } from '@/lib/db/maestros'
import { getSession } from '@/lib/auth/session'

interface Params { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const data = await getRemisionById(id)
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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

      const lineas = ((rem as { lineas?: unknown }).lineas ?? []) as {
        producto?: { id?: string } | null
        impuesto?: { id?: string } | null
        descripcion?: string | null
        cantidad: number
        precio_unitario: number
        descuento_porcentaje?: number | null
      }[]
      const [empresa_id, ejercicio] = await Promise.all([getEmpresaId(), getEjercicioActivo()])
      if (!ejercicio?.id) {
        return NextResponse.json({ error: 'No hay ejercicio activo' }, { status: 400 })
      }
      const cliente = (rem as { cliente?: { id?: string } | null }).cliente ?? null
      const bodega = (rem as { bodega?: { id?: string } | null }).bodega ?? null
      const hoy = new Date().toISOString().split('T')[0]

      const facturaId = await createFactura({
        empresa_id,
        ejercicio_id: ejercicio.id,
        cliente_id: cliente?.id ?? '',
        bodega_id: bodega?.id ?? '',
        forma_pago_id,
        colaborador_id: null,
        fecha: hoy,
        fecha_vencimiento: vencimiento ?? hoy,
        observaciones: (rem as { observaciones?: string | null }).observaciones ?? null,
        lineas: lineas.map((l) => ({
          producto_id: l.producto?.id ?? '',
          variante_id: null,
          impuesto_id: l.impuesto?.id ?? null,
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
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
