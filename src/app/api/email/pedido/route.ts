import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getResend, emailFrom, htmlPedido } from '@/lib/email'
import { formatCOP, formatFecha } from '@/utils/cn'
import { getSession } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id, email_destino } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const supabase = await createClient()

    const [{ data: doc }, { data: empresa }] = await Promise.all([
      supabase.from('documentos')
        .select('numero, prefijo, fecha, total, cliente:cliente_id(razon_social, email)')
        .eq('id', id).eq('tipo', 'pedido').single(),
      supabase.from('empresas').select('nombre, nit, dv').limit(1).single(),
    ])

    if (!doc) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    const cliente = doc.cliente as { razon_social?: string; email?: string } | null
    const destino = email_destino || cliente?.email
    if (!destino) return NextResponse.json({ error: 'El cliente no tiene email registrado' }, { status: 400 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://erp.tudominio.com'
    const resend = getResend()

    const { error } = await resend.emails.send({
      from: emailFrom,
      to: [destino],
      subject: `Pedido ${doc.prefijo ?? ''}${doc.numero} — ${empresa?.nombre ?? ''}`,
      html: htmlPedido({
        empresa:  empresa?.nombre ?? '',
        nit:      `${empresa?.nit ?? ''}${empresa?.dv ? `-${empresa.dv}` : ''}`,
        cliente:  cliente?.razon_social ?? 'Cliente',
        numero:   `${doc.prefijo ?? ''}${doc.numero}`,
        fecha:    formatFecha(doc.fecha),
        total:    formatCOP(doc.total),
        link:     `${appUrl}/print/pedido/${id}`,
      }),
    })

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, enviado_a: destino })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
