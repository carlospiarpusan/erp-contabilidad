import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

const ROLES = ['admin', 'contador']

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ROLES.includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('pagos_proveedores')
      .select('*, proveedor:proveedores(id,razon_social,numero_documento), cuenta:cuentas_bancarias(id,nombre,banco), forma_pago:formas_pago(id,nombre)')
      .eq('empresa_id', session.empresa_id)
      .order('fecha', { ascending: false })
      .limit(100)
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ROLES.includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json()
    const { proveedor_id, cuenta_bancaria_id, forma_pago_id, monto_total, referencia, observaciones } = body
    if (!proveedor_id || !monto_total)
      return NextResponse.json({ error: 'Proveedor y monto son requeridos' }, { status: 400 })

    const supabase = await createClient()

    // Get next numero
    const { data: maxRow } = await supabase
      .from('pagos_proveedores')
      .select('numero')
      .eq('empresa_id', session.empresa_id)
      .order('numero', { ascending: false })
      .limit(1)
      .single()

    const numero = (maxRow?.numero ?? 0) + 1

    const { data, error } = await supabase
      .from('pagos_proveedores')
      .insert({
        empresa_id: session.empresa_id,
        numero,
        proveedor_id,
        cuenta_bancaria_id: cuenta_bancaria_id || null,
        forma_pago_id: forma_pago_id || null,
        monto_total: Number(monto_total),
        referencia: referencia || null,
        observaciones: observaciones || null,
        estado: 'pagado',
        created_by: session.id,
      })
      .select('*, proveedor:proveedores(id,razon_social,numero_documento), cuenta:cuentas_bancarias(id,nombre,banco), forma_pago:formas_pago(id,nombre)')
      .single()
    if (error) throw error

    // Register bank movement if account is specified
    if (cuenta_bancaria_id) {
      await supabase.rpc('registrar_movimiento_bancario', {
        p_cuenta_id: cuenta_bancaria_id,
        p_tipo: 'egreso',
        p_concepto: 'pago_proveedor',
        p_monto: Number(monto_total),
        p_referencia: referencia || `Pago #${numero}`,
        p_descripcion: `Pago a proveedor`,
        p_documento_id: null,
      })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
