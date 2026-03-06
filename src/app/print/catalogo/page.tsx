export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/utils/cn'
import { PrintButton } from '@/components/print/PrintButton'

export default async function PrintCatalogoPage() {
  const supabase = await createClient()

  const [{ data: productos }, { data: empresa }] = await Promise.all([
    supabase
      .from('productos')
      .select('id, codigo, descripcion, precio_venta, precio_venta2, stock_actual, unidad, familia:familia_id(descripcion)')
      .eq('activo', true)
      .order('descripcion'),
    supabase
      .from('empresas')
      .select('nombre, nit, dv, telefono, email')
      .limit(1)
      .single(),
  ])

  // Agrupar por familia
  const grupos: Record<string, typeof productos> = {}
  for (const p of productos ?? []) {
    const familia = (p.familia as { descripcion?: string } | null)?.descripcion ?? 'Sin familia'
    if (!grupos[familia]) grupos[familia] = []
    grupos[familia].push(p)
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden flex items-center gap-3 px-6 py-3 bg-gray-100 border-b border-gray-200">
        <PrintButton />
        <a href="/productos/catalogo" className="text-sm text-gray-500 hover:text-gray-700">← Volver</a>
        <span className="text-xs text-gray-400">{productos?.length ?? 0} productos</span>
      </div>

      <div className="px-8 py-8 print:px-4 print:py-4">

        {/* Encabezado */}
        <div className="flex justify-between items-start mb-8 pb-4 border-b-2 border-gray-800">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 uppercase">{empresa?.nombre ?? 'CATÁLOGO'}</h1>
            {empresa?.nit && <p className="text-sm text-gray-600">NIT: {empresa.nit}{empresa.dv ? `-${empresa.dv}` : ''}</p>}
            {empresa?.telefono && <p className="text-sm text-gray-500">{empresa.telefono}</p>}
            {empresa?.email && <p className="text-sm text-gray-500">{empresa.email}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Lista de precios</p>
            <p className="text-sm text-gray-600">{new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p className="text-xs text-gray-400 mt-1">{productos?.length ?? 0} productos</p>
          </div>
        </div>

        {/* Productos por familia */}
        {Object.entries(grupos).map(([familia, prods]) => (
          <div key={familia} className="mb-8 print:break-inside-avoid-page">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 pb-1 border-b border-gray-300">
              {familia}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 print:grid-cols-4">
              {(prods ?? []).map(p => (
                <div key={p.id}
                  className="border border-gray-200 rounded-lg p-3 print:break-inside-avoid">
                  <p className="text-xs text-gray-400 font-mono mb-1">{p.codigo}</p>
                  <p className="text-sm font-medium text-gray-800 leading-tight mb-2 min-h-[2.5rem]">
                    {p.descripcion}
                  </p>
                  <div className="border-t border-gray-100 pt-2">
                    <p className="text-base font-bold text-gray-900">{formatCOP(p.precio_venta)}</p>
                    {p.precio_venta2 && p.precio_venta2 > 0 && p.precio_venta2 !== p.precio_venta && (
                      <p className="text-xs text-gray-500">Mayorista: {formatCOP(p.precio_venta2)}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Stock: {p.stock_actual ?? 0} {p.unidad ?? 'und'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <p className="text-xs text-gray-400 text-center mt-8 print:block">
          Precios en pesos colombianos (COP) · Sujetos a cambios sin previo aviso
        </p>
      </div>
    </div>
  )
}
