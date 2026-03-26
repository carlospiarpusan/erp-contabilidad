import { NextRequest, NextResponse } from 'next/server'
import { toErrorMsg } from '@/lib/utils/errors'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'
import { getResend, emailFrom, htmlRecordatorioCobro } from '@/lib/email'
import { headers } from 'next/headers'
import { getSession } from '@/lib/auth/session'

// POST { cliente_id } — envía recordatorio de cobro con todas las facturas vencidas del cliente
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { cliente_id } = await req.json()
    if (!cliente_id) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

    const hdrs = await headers()
    const host = hdrs.get('host') ?? 'localhost:3000'
    const proto = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${proto}://${host}`

    const [supabase, empresa_id] = await Promise.all([createClient(), getEmpresaId()])

    // Obtener empresa
    const { data: empresa } = await supabase
      .from('empresas')
      .select('nombre, nit')
      .eq('id', empresa_id)
      .single()

    // Obtener cliente
    const { data: cliente } = await supabase
      .from('clientes')
      .select('razon_social, email')
      .eq('id', cliente_id)
      .eq('empresa_id', empresa_id)
      .single()

    if (!cliente?.email) {
      return NextResponse.json({ error: 'El cliente no tiene email registrado' }, { status: 400 })
    }

    const hoy = new Date().toISOString().slice(0, 10)

    // Facturas vencidas
    const { data: facturas } = await supabase
      .from('documentos')
      .select('id, numero, prefijo, fecha_vencimiento, total, recibos(valor)')
      .eq('empresa_id', empresa_id)
      .eq('tipo', 'factura_venta')
      .eq('cliente_id', cliente_id)
      .in('estado', ['pendiente', 'vencida'])
      .lt('fecha_vencimiento', hoy)
      .order('fecha_vencimiento')

    if (!facturas?.length) {
      return NextResponse.json({ error: 'Este cliente no tiene facturas vencidas' }, { status: 400 })
    }

    const facturasConSaldo = facturas.map((f: any) => {
      const pagado = (f.recibos ?? []).reduce((s: number, r: any) => s + r.valor, 0)
      const saldo = f.total - pagado
      return {
        numero: `${f.prefijo}${f.numero}`,
        fecha_vencimiento: f.fecha_vencimiento,
        saldo: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(saldo),
        link: `${baseUrl}/ventas/facturas/${f.id}`,
        saldoNum: saldo,
      }
    }).filter(f => f.saldoNum > 0.01)

    if (!facturasConSaldo.length) {
      return NextResponse.json({ error: 'No hay saldos pendientes' }, { status: 400 })
    }

    const totalNum = facturasConSaldo.reduce((s, f) => s + f.saldoNum, 0)
    const total = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalNum)

    const resend = getResend()
    const html = htmlRecordatorioCobro({
      empresa: empresa?.nombre ?? 'Empresa',
      nit: empresa?.nit ?? '—',
      cliente: cliente.razon_social,
      facturas: facturasConSaldo,
      total,
    })

    const { error } = await resend.emails.send({
      from: emailFrom,
      to: cliente.email,
      subject: `Recordatorio de pago — ${total} pendiente`,
      html,
    })

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, enviado_a: cliente.email, facturas: facturasConSaldo.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
