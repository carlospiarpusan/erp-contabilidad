export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/utils/cn'
import { Tag } from 'lucide-react'

export default async function ListaPreciosPage() {
  const supabase = await createClient()

  // Get unique price lists (by nombre + tipo)
  const { data: listas } = await supabase
    .from('listas_precios')
    .select('nombre, tipo, valida_desde, valida_hasta')
    .order('nombre')

  // Get all price entries with product info
  const { data: precios } = await supabase
    .from('listas_precios')
    .select('nombre, tipo, precio, descuento_porcentaje, valida_desde, valida_hasta, producto:producto_id(codigo, descripcion), cliente:cliente_id(razon_social), grupo:grupo_id(nombre)')
    .order('nombre')

  const rows = precios ?? []

  // Group by lista name
  const grupos: Record<string, typeof rows> = {}
  for (const r of rows) {
    const key = r.nombre ?? 'Sin nombre'
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(r)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <Tag className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Listas de Precios</h1>
          <p className="text-sm text-gray-500">{rows.length} precio{rows.length !== 1 ? 's' : ''} especial{rows.length !== 1 ? 'es' : ''} configurado{rows.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <Tag className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay listas de precios configuradas</p>
          <p className="text-sm text-gray-400 mt-1">
            Las listas de precios se configuran por producto, cliente o grupo de clientes.
          </p>
        </div>
      ) : Object.entries(grupos).map(([nombre, items]) => (
        <div key={nombre} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 bg-blue-50 border-b border-blue-100">
            <h3 className="font-semibold text-blue-900">{nombre}</h3>
            <p className="text-xs text-blue-600">{items.length} producto{items.length !== 1 ? 's' : ''}</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Producto</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Para</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Precio especial</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Dcto%</th>
                <th className="px-4 py-2 text-center font-semibold text-gray-600">Validez</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((r, i) => {
                const prod   = r.producto as { codigo?: string; descripcion?: string } | null
                const cliente = r.cliente as { razon_social?: string } | null
                const grupo  = r.grupo as { nombre?: string } | null
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <p className="text-gray-900">{prod?.descripcion ?? '—'}</p>
                      {prod?.codigo && <p className="text-xs text-gray-400 font-mono">{prod.codigo}</p>}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {cliente?.razon_social ?? grupo?.nombre ?? 'Todos'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-blue-700">
                      {r.precio ? formatCOP(r.precio) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">
                      {r.descuento_porcentaje ? `${r.descuento_porcentaje}%` : '—'}
                    </td>
                    <td className="px-4 py-2 text-center text-xs text-gray-500">
                      {r.valida_desde ? `${r.valida_desde} — ${r.valida_hasta ?? '∞'}` : 'Siempre'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
