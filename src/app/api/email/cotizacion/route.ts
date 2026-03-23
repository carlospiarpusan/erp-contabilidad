import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getResend, emailFrom, htmlCotizacion } from '@/lib/email'
import { formatCOP, formatFecha } from '@/utils/cn'
import { getSession } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id, email_destino } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const supabase = await createClient()

    const [{ data: cot }, { data: empresa }] = await Promise.all([
      supabase.from('documentos')
        .select('numero, prefijo, fecha, fecha_vencimiento, total, cliente:cliente_id(razon_social, email)')
        .eq('id', id).eq('tipo', 'cotizacion').single(),
      supabase.from('empresas').select('nombre, nit, dv').limit(1).single(),
    ])

    if (!cot) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

    const cliente = cot.cliente as { razon_social?: string; email?: string } | null
    const destino = email_destino || cliente?.email
    if (!destino) return NextResponse.json({ error: 'El cliente no tiene email registrado' }, { status: 400 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clovent.co'
    const resend = getResend()

    const { error } = await resend.emails.send({
      from: emailFrom,
      to: [destino],
      subject: `Cotización ${cot.prefijo ?? ''}${cot.numero} — ${empresa?.nombre ?? ''}`,
      html: htmlCotizacion({
        empresa:     empresa?.nombre ?? '',
        nit:         `${empresa?.nit ?? ''}${empresa?.dv ? `-${empresa.dv}` : ''}`,
        cliente:     cliente?.razon_social ?? 'Cliente',
        numero:      `${cot.prefijo ?? ''}${cot.numero}`,
        fecha:       formatFecha(cot.fecha),
        vencimiento: cot.fecha_vencimiento ? formatFecha(cot.fecha_vencimiento as string) : '—',
        total:       formatCOP(cot.total),
        link:        `${appUrl}/print/cotizacion/${id}`,
      }),
    })

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, enviado_a: destino })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
