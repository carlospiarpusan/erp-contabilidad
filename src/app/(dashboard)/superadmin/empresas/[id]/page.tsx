export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { ArrowLeft, Building2 } from 'lucide-react'
import { GestionUsuariosEmpresa } from '@/components/superadmin/GestionUsuariosEmpresa'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export default async function EmpresaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.rol !== 'superadmin') redirect('/')
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) redirect('/')

  const { id } = await params
  const admin = adminClient()

  const [{ data: empresa }, { data: usuarios }, { data: roles }] = await Promise.all([
    admin.from('empresas').select('*').eq('id', id).single(),
    admin.from('usuarios').select('id, nombre, email, telefono, activo, created_at, rol_id').eq('empresa_id', id).order('nombre'),
    admin.from('roles').select('id, nombre, descripcion').order('nombre'),
  ])

  if (!empresa) notFound()

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/superadmin/empresas" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{empresa.nombre}</h1>
          <p className="text-sm text-gray-500">NIT: {empresa.nit} · {empresa.ciudad ?? 'Sin ciudad'}</p>
        </div>
      </div>

      {/* Datos empresa */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        {[
          { label: 'Nombre', value: empresa.nombre },
          { label: 'NIT', value: empresa.nit },
          { label: 'Email', value: empresa.email ?? '—' },
          { label: 'Teléfono', value: empresa.telefono ?? '—' },
          { label: 'Ciudad', value: empresa.ciudad ?? '—' },
          { label: 'Estado', value: empresa.activa ? 'Activa' : 'Inactiva' },
        ].map(f => (
          <div key={f.label}>
            <p className="text-xs text-gray-400 mb-0.5">{f.label}</p>
            <p className="font-medium text-gray-900 dark:text-white">{f.value}</p>
          </div>
        ))}
      </div>

      {/* Usuarios */}
      <GestionUsuariosEmpresa
        empresa_id={id}
        usuarios={(usuarios ?? []).map(u => ({
          ...u,
          roles: (roles ?? []).find(r => r.id === u.rol_id) ?? null,
        }))}
        roles={roles ?? []}
      />
    </div>
  )
}
