export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getEstadisticasGlobales } from '@/lib/db/superadmin'
import { hasSupabaseServiceEnv } from '@/lib/supabase/config'
import { formatCOP } from '@/utils/cn'
import Link from 'next/link'
import {
  Building2, Users, TrendingUp, ShoppingCart,
  Plus, Settings, Shield, Activity,
} from 'lucide-react'

export default async function SuperadminHomePage() {
  const session = await getSession()
  if (!session || session.rol !== 'superadmin') redirect('/')

  const hasSuperadminConfig = hasSupabaseServiceEnv()
  if (!hasSuperadminConfig) {
    return (
      <div className="max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-bold text-amber-900">Configuración incompleta de Superadmin</h1>
        <p className="mt-2 text-sm text-amber-800">
          Falta configurar <code>SUPABASE_SERVICE_ROLE_KEY</code> en Vercel.
        </p>
      </div>
    )
  }

  let stats
  try {
    stats = await getEstadisticasGlobales()
  } catch {
    return (
      <div className="max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-bold text-red-900">No se pudo cargar el panel superadmin</h1>
        <p className="mt-2 text-sm text-red-800">
          Revisa variables de entorno y conexión con Supabase en producción.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Panel de Administración</h1>
          <p className="text-sm text-gray-500">Gestión global de la plataforma ERP</p>
        </div>
        <div className="flex gap-2">
          <Link href="/superadmin/empresas"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700">
            <Plus className="h-4 w-4" /> Nueva empresa
          </Link>
          <Link href="/superadmin/usuarios"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
            <Users className="h-4 w-4" /> Usuarios
          </Link>
        </div>
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Empresas activas',   value: stats.totalEmpresas,    icon: Building2,   color: 'bg-violet-100 text-violet-600', href: '/superadmin/empresas' },
          { label: 'Usuarios totales',   value: stats.totalUsuarios,    icon: Users,       color: 'bg-blue-100   text-blue-600',   href: '/superadmin/usuarios' },
          { label: 'Facturas de venta',  value: stats.totalFacturas,    icon: TrendingUp,  color: 'bg-green-100  text-green-600',  href: null },
          { label: 'Facturas de compra', value: stats.totalComprasDocs, icon: ShoppingCart,color: 'bg-orange-100 text-orange-600', href: null },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${k.color} mb-3`}>
              <k.icon className="h-4 w-4" />
            </div>
            <p className="text-xs text-gray-500 mb-0.5">{k.label}</p>
            {k.href ? (
              <Link href={k.href} className="text-2xl font-bold text-gray-900 dark:text-white hover:text-violet-600">
                {k.value.toLocaleString('es-CO')}
              </Link>
            ) : (
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{k.value.toLocaleString('es-CO')}</p>
            )}
          </div>
        ))}
      </div>

      {/* Volumen financiero global */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Ventas totales plataforma',  value: stats.totalVentas,   color: 'text-green-700',  bg: 'bg-green-50  dark:bg-green-900/10' },
          { label: 'Compras totales plataforma', value: stats.totalCompras,  color: 'text-orange-700', bg: 'bg-orange-50 dark:bg-orange-900/10' },
          { label: 'Ventas este mes',             value: stats.ventasMes,    color: 'text-blue-700',   bg: 'bg-blue-50   dark:bg-blue-900/10' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border border-gray-100 dark:border-gray-800 ${k.bg} p-4`}>
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-xl font-bold font-mono ${k.color}`}>{formatCOP(k.value)}</p>
          </div>
        ))}
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/superadmin/empresas"
          className="rounded-xl border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/10 p-5 hover:bg-violet-100 dark:hover:bg-violet-900/20 transition-colors">
          <Building2 className="h-6 w-6 text-violet-600 mb-3" />
          <p className="font-semibold text-violet-900 dark:text-violet-300">Gestionar empresas</p>
          <p className="text-xs text-violet-600 dark:text-violet-500 mt-0.5">
            Crear, editar o desactivar empresas. Ver sus datos y usuarios.
          </p>
        </Link>
        <Link href="/superadmin/usuarios"
          className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/10 p-5 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors">
          <Shield className="h-6 w-6 text-blue-600 mb-3" />
          <p className="font-semibold text-blue-900 dark:text-blue-300">Gestionar usuarios</p>
          <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">
            Ver todos los usuarios, roles y accesos del sistema.
          </p>
        </Link>
        <Link href="/superadmin/empresas"
          className="rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10 p-5 hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors">
          <Plus className="h-6 w-6 text-green-600 mb-3" />
          <p className="font-semibold text-green-900 dark:text-green-300">Nueva empresa</p>
          <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
            Registrar una nueva empresa con su administrador.
          </p>
        </Link>
      </div>

      {/* Tabla de empresas */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-400" />
            <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Empresas registradas</span>
          </div>
          <Link href="/superadmin/empresas" className="text-xs text-violet-600 hover:underline">Ver todas →</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Empresa</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">NIT</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Usuarios</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Documentos</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Ventas totales</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Estado</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {stats.empresas.map(e => (
              <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{e.nombre}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.nit}</td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{e.total_usuarios}</td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{e.total_documentos}</td>
                <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-green-700">{formatCOP(e.total_ventas)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    e.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {e.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/superadmin/empresas/${e.id}`} className="text-xs text-violet-600 hover:underline">
                    Gestionar →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
