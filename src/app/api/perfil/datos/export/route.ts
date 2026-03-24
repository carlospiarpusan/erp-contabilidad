import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getUserPersonalDataExport } from '@/lib/db/compliance'
import { toErrorMsg } from '@/lib/utils/errors'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const data = await getUserPersonalDataExport(session)
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="mis-datos-${new Date().toISOString().split('T')[0]}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}
