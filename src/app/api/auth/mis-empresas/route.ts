import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { resolveRoleById } from '@/lib/auth/permissions'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import { toErrorMsg } from '@/lib/utils/errors'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = await createClient()

    // RLS policy allows user to see own memberships
    const { data, error } = await supabase
      .from('usuario_empresas')
      .select('empresa_id, rol_id, es_principal, empresas(id, nombre, nit)')
      .eq('usuario_id', session.id)
      .eq('activo', true)
      .order('es_principal', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const empresas = (data ?? []).map((row) => {
      const empresa = Array.isArray(row.empresas) ? row.empresas[0] : row.empresas
      const rol = resolveRoleById(row.rol_id)
      return {
        empresa_id: row.empresa_id,
        nombre: empresa?.nombre ?? '',
        nit: empresa?.nit ?? '',
        rol: rol ?? 'solo_lectura',
        rol_label: rol ? ROLE_LABELS[rol] : 'Sin rol',
        es_principal: row.es_principal,
        es_activa: row.empresa_id === session.empresa_id,
      }
    })

    return NextResponse.json(empresas)
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
