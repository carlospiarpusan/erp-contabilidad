export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getUsuarios } from '@/lib/db/usuarios'
import { ROLE_IDS } from '@/lib/auth/permissions'
import { Users } from 'lucide-react'
import { FormColaboradores } from '@/components/configuracion/FormColaboradores'

export default async function ColaboradoresPage() {
  const supabase = await createClient()
  const [{ data }, usuarios] = await Promise.all([
    supabase
      .from('colaboradores')
      .select('id, nombre, usuario_id, email, telefono, porcentaje_comision, meta_mensual, activo')
      .order('nombre'),
    getUsuarios(),
  ])

  const usuariosDisponibles = usuarios
    .filter((usuario) => usuario.activo && usuario.rol_id !== ROLE_IDS.superadmin)
    .map((usuario) => ({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
    }))

  const usuarioLabelById = new Map(
    usuariosDisponibles.map((usuario) => [usuario.id, `${usuario.nombre} (${usuario.email})`])
  )
  const colaboradores = (data ?? []).map((colaborador) => ({
    ...colaborador,
    usuario_label: colaborador.usuario_id
      ? (usuarioLabelById.get(colaborador.usuario_id) ?? null)
      : null,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
          <Users className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Colaboradores</h1>
          <p className="text-sm text-gray-500">Vendedores y empleados de la empresa</p>
        </div>
      </div>

      <FormColaboradores colaboradores={colaboradores} usuarios={usuariosDisponibles} />
    </div>
  )
}
