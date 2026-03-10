export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { hasSupabaseServiceEnv } from '@/lib/supabase/config'
import Link from 'next/link'
import { Building2, Users, Plus } from 'lucide-react'
import { NuevaEmpresaForm } from '@/components/superadmin/NuevaEmpresaForm'

function adminClient() {
  return createServiceClient()
}

export default async function SuperadminEmpresasPage() {
  const session = await getSession()
  if (!session || session.rol !== 'superadmin') redirect('/')
  if (!hasSupabaseServiceEnv()) redirect('/')

  const admin = adminClient()
  const { data: empresas } = await admin
    .from('empresas')
    .select('id, nombre, nit, ciudad, activa, created_at')
    .order('nombre')

  // Contar usuarios por empresa
  const { data: conteos } = await admin
    .from('usuarios')
    .select('empresa_id')
  const conteoPorEmpresa: Record<string, number> = {}
  for (const u of conteos ?? []) {
    conteoPorEmpresa[u.empresa_id] = (conteoPorEmpresa[u.empresa_id] ?? 0) + 1
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Empresas</h1>
            <p className="text-sm text-gray-500">{empresas?.length ?? 0} empresa{empresas?.length !== 1 ? 's' : ''} registrada{empresas?.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Tabla empresas */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Empresa</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">NIT</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Ciudad</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Usuarios</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Estado</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {(empresas ?? []).map(e => (
              <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{e.nombre}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{e.nit}</td>
                <td className="px-4 py-3 text-gray-500">{e.ciudad ?? '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
                    <Users className="h-3.5 w-3.5" />
                    {conteoPorEmpresa[e.id] ?? 0}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    e.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {e.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/superadmin/empresas/${e.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Gestionar →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Formulario nueva empresa */}
      <div className="rounded-xl border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="h-4 w-4 text-violet-600" />
          <h2 className="font-semibold text-violet-800 dark:text-violet-300">Crear nueva empresa</h2>
        </div>
        <NuevaEmpresaForm />
      </div>
    </div>
  )
}
