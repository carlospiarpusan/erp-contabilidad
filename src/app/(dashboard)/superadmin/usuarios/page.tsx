export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Users } from 'lucide-react'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const ROL_COLOR: Record<string, string> = {
  superadmin: 'bg-violet-100 text-violet-700',
  admin:      'bg-red-100 text-red-700',
  contador:   'bg-blue-100 text-blue-700',
  vendedor:   'bg-green-100 text-green-700',
  solo_lectura:'bg-yellow-100 text-yellow-700',
}

export default async function SuperadminUsuariosPage() {
  const session = await getSession()
  if (!session || session.rol !== 'superadmin') redirect('/')

  const admin = adminClient()
  const { data: usuarios } = await admin
    .from('usuarios')
    .select('id, nombre, email, activo, created_at, roles(nombre), empresas(nombre)')
    .order('nombre')

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600">
          <Users className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Todos los usuarios</h1>
          <p className="text-sm text-gray-500">{usuarios?.length ?? 0} usuarios en el sistema</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Usuario</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Empresa</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Rol</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {(usuarios ?? []).map(u => {
              const rol = ((Array.isArray(u.roles) ? u.roles[0] : u.roles) as { nombre: string } | null)?.nombre ?? ''
              const empresa = ((Array.isArray(u.empresas) ? u.empresas[0] : u.empresas) as { nombre: string } | null)?.nombre ?? '—'
              return (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{u.nombre}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{empresa}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROL_COLOR[rol] ?? 'bg-gray-100 text-gray-600'}`}>
                      {rol || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
