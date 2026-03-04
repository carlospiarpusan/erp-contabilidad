export const dynamic = 'force-dynamic'

import { getUsuarios, getRoles } from '@/lib/db/usuarios'
import { ListaUsuarios } from '@/components/usuarios/ListaUsuarios'
import { Shield } from 'lucide-react'

export default async function UsuariosPage() {
  const [usuarios, roles] = await Promise.all([getUsuarios(), getRoles()])

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
          <Shield className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestión de usuarios</h1>
          <p className="text-sm text-gray-500">Administra roles y accesos al sistema</p>
        </div>
      </div>

      {/* Info de roles */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        {[
          { rol: 'admin',       desc: 'Acceso total',         color: 'bg-red-50 text-red-700 border-red-200' },
          { rol: 'contador',    desc: 'Contabilidad e inf.',  color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { rol: 'vendedor',    desc: 'Ventas y clientes',    color: 'bg-green-50 text-green-700 border-green-200' },
          { rol: 'solo_lectura',desc: 'Solo consultas',       color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
        ].map(r => (
          <div key={r.rol} className={`rounded-lg border p-3 ${r.color}`}>
            <p className="font-semibold text-sm capitalize">{r.rol.replace('_', ' ')}</p>
            <p className="text-xs mt-0.5 opacity-75">{r.desc}</p>
          </div>
        ))}
      </div>

      <ListaUsuarios usuarios={usuarios} roles={roles ?? []} />
    </div>
  )
}
