import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getResend, emailFrom, htmlRemision } from '@/lib/email'
import { formatFecha } from '@/utils/cn'

export async function POST(req: NextRequest) {
  try {
    const { id, email_destino } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const supabase = await createClient()

    const [{ data: rem }, { data: empresa }] = await Promise.all([
      supabase.from('documentos')
        .select('numero, prefijo, fecha, cliente:cliente_id(razon_social, email)')
        .eq('id', id).eq('tipo', 'remision').single(),
      supabase.from('empresas').select('nombre, nit, dv').limit(1).single(),
    ])

    if (!rem) return NextResponse.json({ error: 'Remisión no encontrada' }, { status: 404 })

    const cliente = rem.cliente as { razon_social?: string; email?: string } | null
    const destino = email_destino || cliente?.email
    if (!destino) return NextResponse.json({ error: 'El cliente no tiene email registrado' }, { status: 400 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://erp.tudominio.com'
    const resend = getResend()

    const { error } = await resend.emails.send({
      from: emailFrom,
      to: [destino],
      subject: `Remisión ${rem.prefijo ?? ''}${rem.numero} — ${empresa?.nombre ?? ''}`,
      html: htmlRemision({
        empresa: empresa?.nombre ?? '',
        nit:     `${empresa?.nit ?? ''}${empresa?.dv ? `-${empresa.dv}` : ''}`,
        cliente: cliente?.razon_social ?? 'Cliente',
        numero:  `${rem.prefijo ?? ''}${rem.numero}`,
        fecha:   formatFecha(rem.fecha),
        link:    `${appUrl}/print/remision/${id}`,
      }),
    })

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, enviado_a: destino })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
