import { NextRequest, NextResponse } from 'next/server'
import { getCotizacionById, aprobarCotizacion, cancelarCotizacion } from '@/lib/db/cotizaciones'
import { createFactura } from '@/lib/db/ventas'
import { getEjercicioActivo, getEmpresaId } from '@/lib/db/maestros'
import { createClient } from '@/lib/supabase/server'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const data = await getCotizacionById(id)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { accion, forma_pago_id, vencimiento } = await req.json()

    if (accion === 'aprobar') {
      await aprobarCotizacion(id)
      return NextResponse.json({ ok: true })
    }

    if (accion === 'cancelar') {
      await cancelarCotizacion(id)
      return NextResponse.json({ ok: true })
    }

    if (accion === 'convertir') {
      // Load cotizacion
      const cotizacion = await getCotizacionById(id)
      if (!cotizacion) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
      if (cotizacion.estado === 'convertida') return NextResponse.json({ error: 'Ya fue convertida' }, { status: 400 })

      const lineas = (cotizacion.lineas ?? []) as unknown as {
        producto?: { id: string } | null; impuesto?: { id: string } | null
        descripcion?: string | null; cantidad: number; precio_unitario: number; descuento_porcentaje: number
      }[]

      const [empresa_id, ejercicio_id] = await Promise.all([getEmpresaId(), getEjercicioActivo()])
      const bodega = cotizacion.bodega as { id?: string } | null
      const hoy = new Date().toISOString().split('T')[0]

      const facturaId = await createFactura({
        empresa_id,
        ejercicio_id,
        cliente_id:        (cotizacion.cliente as { id?: string } | null)?.id ?? '',
        bodega_id:         bodega?.id ?? '',
        forma_pago_id:     forma_pago_id ?? '',
        colaborador_id:    null,
        fecha:             cotizacion.fecha as string,
        fecha_vencimiento: vencimiento ?? hoy,
        observaciones:     cotizacion.observaciones ?? null,
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

      // Mark cotizacion as converted + link origen
      const supabase = await createClient()
      await supabase.from('documentos').update({
        estado: 'convertida', updated_at: new Date().toISOString(),
      }).eq('id', id)
      await supabase.from('documentos').update({
        documento_origen_id: id,
      }).eq('id', facturaId)

      return NextResponse.json({ id: facturaId })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
