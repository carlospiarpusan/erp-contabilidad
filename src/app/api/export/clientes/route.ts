import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { createExportResponse, resolveExportFormat } from '@/lib/utils/csv'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const format = resolveExportFormat(searchParams.get('format'))

    const supabase = await createClient()
    const pageSize = 500

    async function* rows() {
      let offset = 0

      while (true) {
        const { data, error } = await supabase
          .from('clientes')
          .select('codigo:numero_documento, razon_social, nombre_contacto, tipo_documento, numero_documento, email, telefono, whatsapp, ciudad, departamento, direccion, activo, grupo:grupo_id(nombre), colaborador:colaborador_id(nombre)')
          .order('razon_social')
          .range(offset, offset + pageSize - 1)

        if (error) throw error

        const batch = data ?? []
        if (!batch.length) break

        for (const row of batch) {
          const grupo = row.grupo as { nombre?: string } | null
          const colaborador = row.colaborador as { nombre?: string } | null

          yield [
            row.razon_social ?? '',
            row.tipo_documento ?? '',
            row.numero_documento ?? '',
            row.nombre_contacto ?? '',
            row.email ?? '',
            row.telefono ?? '',
            row.whatsapp ?? '',
            row.ciudad ?? '',
            row.departamento ?? '',
            row.direccion ?? '',
            grupo?.nombre ?? '',
            colaborador?.nombre ?? '',
            row.activo ? 'Sí' : 'No',
          ]
        }

        if (batch.length < pageSize) break
        offset += pageSize
      }
    }

    return createExportResponse({
      format,
      baseFilename: `clientes-${new Date().toISOString().split('T')[0]}`,
      headers: ['Razón social', 'Tipo documento', 'Documento', 'Contacto', 'Email', 'Teléfono', 'WhatsApp', 'Ciudad', 'Departamento', 'Dirección', 'Grupo', 'Colaborador', 'Activo'],
      rows: rows(),
      sheetName: 'Clientes',
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
