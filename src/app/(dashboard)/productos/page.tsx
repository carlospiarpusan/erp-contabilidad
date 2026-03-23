import { getProductos, getFamilias, getFabricantes, getImpuestos, getEstadisticasInventario, getBodegas } from '@/lib/db/productos'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { ListaProductos } from '@/components/productos/ListaProductos'
import { Package, AlertTriangle, CheckCircle, BarChart3, Upload } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ q?: string; familia_id?: string; fabricante_id?: string; offset?: string; inactivos?: string }>
}

export default async function ProductosPage({ searchParams }: PageProps) {
  const sp           = await searchParams
  const busqueda     = sp.q ?? ''
  const familia_id   = sp.familia_id
  const fabricante_id = sp.fabricante_id
  const offset       = parseInt(sp.offset ?? '0')
  const limit        = 50
  const activo       = sp.inactivos === '1' ? false : true

  const [session, { productos, total }, familias, fabricantes, impuestos, stats, bodegas] = await Promise.all([
    getSession(),
    getProductos({ busqueda, familia_id, fabricante_id, activo, offset, limit }),
    getFamilias(),
    getFabricantes(),
    getImpuestos(),
    getEstadisticasInventario(),
    getBodegas(),
  ])
  const canManage = session ? puedeAcceder(session.rol, 'productos', 'manage') : false
  const canSetInitialStock = session ? puedeAcceder(session.rol, 'inventario', 'manage') : false

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500">
          <Package className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">Artículos / Productos</h2>
          <p className="text-sm text-gray-500">Inventario, precios y variantes</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/configuracion/importar?entidad=productos" className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm text-orange-700 hover:bg-orange-100 transition-colors">
            <Upload className="h-4 w-4" /> Migrar / Importar
          </Link>
          <a href="/api/export/inventario?format=csv" download className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <BarChart3 className="h-4 w-4" /> CSV
          </a>
          <a href="/api/export/inventario?format=xlsx" download className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <BarChart3 className="h-4 w-4" /> XLSX
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Total productos</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total.toLocaleString('es-CO')}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" />Activos</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{stats.activos.toLocaleString('es-CO')}</p>
        </div>
        <Link href="/productos/stock-bajo" className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4 hover:shadow-sm transition-shadow block">
          <p className="text-xs text-gray-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-orange-500" />Stock bajo</p>
          <p className={`text-2xl font-bold mt-1 ${stats.stockBajo > 0 ? 'text-orange-600' : 'text-gray-900 dark:text-gray-100'}`}>
            {stats.stockBajo.toLocaleString('es-CO')}
          </p>
        </Link>
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><BarChart3 className="h-3 w-3 text-blue-500" />Unidades totales</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{stats.unidades.toLocaleString('es-CO')}</p>
        </div>
      </div>

      <ListaProductos
        productos={productos}
        total={total}
        familias={familias}
        fabricantes={fabricantes}
        impuestos={impuestos}
        bodegas={bodegas}
        busqueda={busqueda}
        familiaFiltro={familia_id ?? ''}
        fabricanteFiltro={fabricante_id ?? ''}
        soloInactivos={activo === false}
        offset={offset}
        limit={limit}
        canManage={canManage}
        canSetInitialStock={canSetInitialStock}
      />
    </div>
  )
}
