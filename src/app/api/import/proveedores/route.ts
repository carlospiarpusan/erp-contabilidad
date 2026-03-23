import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { registrarAuditoria } from '@/lib/auditoria'

function parseBoolean(value: unknown, fallback = true) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return fallback
  if (['1', 'si', 'sí', 'true', 'activo'].includes(normalized)) return true
  if (['0', 'no', 'false', 'inactivo'].includes(normalized)) return false
  return fallback
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'configuracion', 'manage')) {
      return NextResponse.json({ error: 'Sin permisos para importar datos' }, { status: 403 })
    }
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
        contacto:  f.contacto?.trim()  || null,
        email:     f.email?.trim()     || null,
        telefono:  f.telefono?.trim()  || null,
        whatsapp:  f.whatsapp?.trim()  || null,
        ciudad:    f.ciudad?.trim()    || null,
        departamento: f.departamento?.trim() || null,
        direccion: f.direccion?.trim() || null,
        activo: parseBoolean(f.activo, true),
      }

      const { error } = await supabase
        .from('proveedores')
        .upsert(payload, { onConflict: 'empresa_id,numero_documento' })

      if (error) return { fila: i + 2, estado: 'error', mensaje: error.message }
      return { fila: i + 2, estado: 'ok' }
    }))

    await registrarAuditoria({
      empresa_id: session.empresa_id,
      usuario_id: session.id,
      tabla: 'import_proveedores',
      accion: 'INSERT',
      datos_nuevos: {
        entidad: 'proveedores',
        total: filas.length,
        exitosos: resultados.filter((item) => item.estado === 'ok').length,
        fallidos: resultados.filter((item) => item.estado === 'error').length,
        detalle: 'Migracion masiva de proveedores desde el centro de migracion.',
      },
      ip: req.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ resultados })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
