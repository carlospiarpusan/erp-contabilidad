import { NextResponse } from 'next/server'
import { getConsecutivos } from '@/lib/db/contabilidad'

export async function GET() {
  try {
    const data = await getConsecutivos()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
