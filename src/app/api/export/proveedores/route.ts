import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { createCsvResponse } from '@/lib/utils/csv'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = await createClient()
    const pageSize = 500

    async function* rows() {
      let offset = 0

      while (true) {
        const { data, error } = await supabase
          .from('proveedores')
          .select('razon_social, contacto, tipo_documento, numero_documento, email, telefono, whatsapp, ciudad, departamento, direccion, activo')
          .order('razon_social')
          .range(offset, offset + pageSize - 1)

        if (error) throw error

        const batch = data ?? []
        if (!batch.length) break

        for (const row of batch) {
          yield [
            row.razon_social ?? '',
            row.tipo_documento ?? '',
            row.numero_documento ?? '',
            row.contacto ?? '',
            row.email ?? '',
            row.telefono ?? '',
            row.whatsapp ?? '',
            row.ciudad ?? '',
            row.departamento ?? '',
            row.direccion ?? '',
            row.activo ? 'Sí' : 'No',
          ]
        }

        if (batch.length < pageSize) break
        offset += pageSize
      }
    }

    return createCsvResponse({
      filename: `proveedores-${new Date().toISOString().split('T')[0]}.csv`,
      headers: ['Razón social', 'Tipo documento', 'Documento', 'Contacto', 'Email', 'Teléfono', 'WhatsApp', 'Ciudad', 'Departamento', 'Dirección', 'Activo'],
      rows: rows(),
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
