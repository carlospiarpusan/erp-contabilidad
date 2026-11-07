import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Boxes } from 'lucide-react'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { ImportarCSV } from '@/components/configuracion/ImportarCSV'

export const dynamic = 'force-dynamic'

export default async function ImportarInventarioPage() {
  const session = await getSession()
  if (!session || !puedeAcceder(session.rol, 'inventario', 'manage')) {
    redirect('/dashboard')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-500">
          <Boxes className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Importar inventario</h1>
          <p className="text-sm text-gray-500">Carga existencias, stock mínimo y costo sobre productos existentes</p>
        </div>
        <Link href="/productos" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50">
          <ArrowLeft className="h-4 w-4" />
          Artículos
        </Link>
      </div>

      <ImportarCSV initialEntidad="inventario-inicial" allowedEntidades={['inventario-inicial']} />
    </div>
  )
}
