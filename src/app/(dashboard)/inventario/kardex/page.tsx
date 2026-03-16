export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { KardexProducto } from '@/components/inventario/KardexProducto'

const ROLES_KARDEX = new Set(['admin', 'contador'])

export default async function KardexPage() {
  const session = await getSession()
  if (!session || !ROLES_KARDEX.has(session.rol)) {
    redirect('/')
  }

  const supabase = await createClient()

  const [{ data: bodegas }, { data: productos }] = await Promise.all([
    supabase.from('bodegas').select('id, nombre').order('nombre'),
    supabase
      .from('productos')
      .select('id, codigo, descripcion')
      .eq('activo', true)
      .order('descripcion'),
  ])

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/productos" className="hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Productos
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
          <ClipboardList className="h-5 w-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Kardex de Inventario</h1>
          <p className="text-sm text-gray-500">Historial de movimientos de stock por producto</p>
        </div>
      </div>

      <KardexProducto bodegas={bodegas ?? []} productos={productos ?? []} />
    </div>
  )
}
