export const dynamic = 'force-dynamic'

import { getUsuarioActual } from '@/lib/db/usuarios'
import { FormPerfil } from '@/components/perfil/FormPerfil'
import { redirect } from 'next/navigation'
import { UserCircle } from 'lucide-react'

export default async function PerfilPage() {
  const usuario = await getUsuarioActual()
  if (!usuario) redirect('/login')

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <UserCircle className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mi perfil</h1>
          <p className="text-sm text-gray-500">Edita tus datos y contraseña</p>
        </div>
      </div>
      <FormPerfil usuario={usuario} />
    </div>
  )
}
