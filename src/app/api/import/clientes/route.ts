import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'
import { getSession } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { filas } = await req.json()
    if (!Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: 'No se recibieron filas' }, { status: 400 })
    }

    const [supabase, empresa_id] = await Promise.all([createClient(), getEmpresaId()])

    const resultados = await Promise.all(filas.map(async (f: Record<string, string>, i: number) => {
      const razon_social     = f.razon_social?.trim()
      const numero_documento = f.numero_documento?.trim()

      if (!razon_social || !numero_documento) {
        return { fila: i + 2, estado: 'error', mensaje: 'razon_social y numero_documento son requeridos' }
      }

      const payload = {
        empresa_id,
        razon_social,
        numero_documento,
        tipo_documento: f.tipo_documento?.trim() || 'NIT',
        email:    f.email?.trim()    || null,
        telefono: f.telefono?.trim() || null,
        direccion: f.direccion?.trim() || null,
        ciudad:   f.ciudad?.trim()   || null,
        activo: true,
      }

      const { error } = await supabase
        .from('clientes')
        .upsert(payload, { onConflict: 'empresa_id,numero_documento' })

      if (error) return { fila: i + 2, estado: 'error', mensaje: error.message }
      return { fila: i + 2, estado: 'ok' }
    }))

    return NextResponse.json({ resultados })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
