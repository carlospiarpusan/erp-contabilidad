export const dynamic = 'force-dynamic'

import { Sidebar } from '@/components/layout/Sidebar'
import type { EmpresaAcceso } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { resolveRoleById, ROLE_LABELS } from '@/lib/auth/permissions'

async function getEmpresasUsuario(userId: string, empresaActiva: string): Promise<EmpresaAcceso[]> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('usuario_empresas')
      .select('empresa_id, rol_id, es_principal, empresas(nombre, nit)')
      .eq('usuario_id', userId)
      .eq('activo', true)
      .order('es_principal', { ascending: false })
    if (!data) return []
    return data.map((row) => {
      const empresa = Array.isArray(row.empresas) ? row.empresas[0] : row.empresas
      const rol = resolveRoleById(row.rol_id)
      return {
        empresa_id: row.empresa_id,
        nombre: empresa?.nombre ?? '',
        nit: empresa?.nit ?? '',
        rol: rol ?? 'solo_lectura',
        rol_label: rol ? ROLE_LABELS[rol] : 'Sin rol',
        es_principal: row.es_principal,
        es_activa: row.empresa_id === empresaActiva,
      }
    })
  } catch {
    return []
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.debe_cambiar_password) redirect('/cambiar-password')

  const empresas = session.tiene_multi_empresa
    ? await getEmpresasUsuario(session.id, session.empresa_id)
    : undefined

  return (
    <div className="clovent-grid flex h-screen overflow-hidden">
      <Sidebar
        rol={session.rol}
        empresaNombre={session.empresa_nombre}
        tieneMultiEmpresa={session.tiene_multi_empresa}
        empresas={empresas}
      />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <Header
          titulo="ClovEnt"
          userName={session.nombre}
          userEmail={session.email}
          userRol={session.rol}
          tieneMultiEmpresa={session.tiene_multi_empresa}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(19,148,135,0.10),transparent_70%)]" />
        <main className="relative flex-1 overflow-y-auto px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  )
}
