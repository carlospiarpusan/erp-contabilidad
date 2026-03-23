'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCOP, formatFecha , cardCls , cn } from '@/utils/cn'
import { Eye, Plus, Download } from 'lucide-react'
import Link from 'next/link'

interface Compra {
  id: string
  numero: number
  prefijo: string
  fecha: string
  numero_externo: string
  total: number
  estado: string
  proveedor?: { id: string; razon_social: string } | null
  bodega?: { nombre: string } | null
}

interface Props { compras: Compra[]; total: number; proveedor_id?: string; proveedorNombre?: string }

const BADGE: Record<string, 'success' | 'danger' | 'warning' | 'outline'> = {
  pendiente: 'warning', pagada: 'success', cancelada: 'danger',
}

const ESTADOS = ['todos', 'pendiente', 'pagada', 'cancelada']

export function ListaCompras({ compras: inicial, total, proveedor_id, proveedorNombre }: Props) {
  const [estado, setEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  const filtradas = inicial.filter(c => {
    const matchEstado = estado === 'todos' || c.estado === estado
    const matchBusqueda = !busqueda ||
      (c.numero_externo ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.proveedor?.razon_social ?? '').toLowerCase().includes(busqueda.toLowerCase())
    return matchEstado && matchBusqueda
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Banner filtro proveedor */}
      {proveedor_id && (
        <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-700">
          <span>Mostrando compras de: <strong>{proveedorNombre ?? 'proveedor seleccionado'}</strong></span>
          <Link href="/compras/facturas" className="text-xs text-orange-500 hover:underline">Ver todas</Link>
        </div>
      )}
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar proveedor o N° factura…"
          className="flex-1 min-w-52 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {ESTADOS.map(e => (
            <button
              key={e}
              onClick={() => setEstado(e)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                estado === e ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-300'
              }`}
            >
              {(e ?? '').charAt(0).toUpperCase() + (e ?? '').slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/export/compras?format=csv" download>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />CSV</Button>
          </a>
          <a href="/api/export/compras?format=xlsx" download>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />XLSX</Button>
          </a>
        </div>

        <Link href="/compras/facturas/nueva">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nueva compra
          </Button>
        </Link>
      </div>

      {/* Tabla */}
      <div className={cn('overflow-x-auto', cardCls)}>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">N° Compra</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Proveedor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Factura prov.</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Bodega</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Total</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  No hay facturas de compra{busqueda ? ` para "${busqueda}"` : ''}
                </td>
              </tr>
            ) : filtradas.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:bg-gray-950/50">
                <td className="px-4 py-3 font-mono text-sm text-gray-600">{c.prefijo}{c.numero}</td>
                <td className="px-4 py-3 text-gray-700">{formatFecha(c.fecha)}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {(c.proveedor as { razon_social?: string } | null)?.razon_social ?? '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.numero_externo}</td>
                <td className="px-4 py-3 text-gray-500">{(c.bodega as { nombre?: string } | null)?.nombre ?? '—'}</td>
                <td className="px-4 py-3 text-right font-mono font-medium text-orange-700">{formatCOP(c.total)}</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={BADGE[c.estado] ?? 'outline'}>
                    {(c.estado ?? '').charAt(0).toUpperCase() + (c.estado ?? '').slice(1)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/compras/facturas/${c.id}`}>
                    <Button size="sm" variant="ghost">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
          {total} factura{total !== 1 ? 's' : ''} en total
        </div>
      </div>
    </div>
  )
}
