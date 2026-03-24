import { NextResponse } from 'next/server'

const MESSAGE =
  'ClovEnt no emite ni transmite facturación electrónica nativa. Usa integración externa con tu proveedor tecnológico.'

export async function GET() {
  return NextResponse.json({ enabled: false, message: MESSAGE }, { status: 410 })
}

export async function POST() {
  return NextResponse.json({ error: MESSAGE }, { status: 410 })
}

export async function PATCH() {
  return NextResponse.json({ error: MESSAGE }, { status: 410 })
}
