'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCOP, formatFecha } from '@/utils/cn'
import { ShoppingCart, CheckCircle, XCircle, Printer } from 'lucide-react'
import Link from 'next/link'

interface Linea {
  id: string; descripcion?: string; cantidad: number
  precio_unitario: number; descuento_porcentaje: number; total: number
  producto?: { codigo: string; descripcion: string } | null
  impuesto?: { porcentaje: number } | null
}
interface Orden {
  id: string; numero: number; prefijo: string; fecha: string; fecha_vencimiento?: string | null
  estado: string; subtotal: number; total_iva: number; total_descuento: number; total: number
  observaciones?: string | null
  proveedor?: { id?: string; razon_social?: string; numero_documento?: string; email?: string; telefono?: string } | null
  bodega?: { nombre?: string } | null
  lineas?: Linea[]
}

const BADGE_ESTADO: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'danger'> = {
  borrador:  'outline',
  aprobada:  'warning',
  recibida:  'success',
  cancelada: 'danger',
}

interface Props { orden: Orden }

export function DetalleOrden({ orden }: Props) {
  const router = useRouter()
  const lineas = (orden.lineas ?? []) as Linea[]
  const [accionando, setAccionando] = useState(false)

  async function ejecutar(accion: string) {
    setAccionando(true)
    try {
      const res = await fetch(`/api/compras/ordenes/${orden.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setAccionando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
              <ShoppingCart className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{orden.prefijo}{orden.numero}</h2>
                <Badge variant={BADGE_ESTADO[orden.estado] ?? 'outline'}>{orden.estado}</Badge>
              </div>
              <p className="text-sm text-gray-500">
                Fecha: {formatFecha(orden.fecha)}
                {orden.fecha_vencimiento && ` · Entrega: ${formatFecha(orden.fecha_vencimiento)}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {orden.estado === 'borrador' && (
              <Button size="sm" onClick={() => ejecutar('aprobar')} disabled={accionando}>
                <CheckCircle className="h-4 w-4 mr-1" /> Aprobar
              </Button>
            )}
            {(orden.estado === 'borrador' || orden.estado === 'aprobada') && (
              <Button size="sm" variant="outline" onClick={() => ejecutar('cancelar')} disabled={accionando}>
                <XCircle className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            )}
            {orden.estado === 'aprobada' && (
              <Link href="/compras/facturas/nueva">
                <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
                  Recibir → Factura compra
                </Button>
              </Link>
            )}
            <Link href={`/print/orden/${orden.id}`} target="_blank"
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <Printer className="h-4 w-4" /> Imprimir
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Proveedor</p>
        <p className="font-semibold text-gray-900">{orden.proveedor?.razon_social ?? '—'}</p>
        {orden.proveedor?.numero_documento && <p className="text-sm text-gray-500">{orden.proveedor.numero_documento}</p>}
        {orden.proveedor?.email && <p className="text-sm text-gray-500">{orden.proveedor.email}</p>}
        {orden.bodega?.nombre && <p className="text-sm text-gray-400 mt-1">Bodega destino: {orden.bodega.nombre}</p>}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Producto</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Cant.</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">P. Costo</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">IVA%</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lineas.map((l, i) => (
              <tr key={l.id ?? i}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{l.producto?.descripcion ?? l.descripcion ?? '—'}</p>
                  {l.producto?.codigo && <p className="text-xs text-gray-400 font-mono">{l.producto.codigo}</p>}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{l.cantidad}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">{formatCOP(l.precio_unitario)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{l.impuesto?.porcentaje ?? 0}%</td>
                <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">{formatCOP(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-56 flex flex-col gap-1 text-sm">
          <div className="flex justify-between py-1 border-b border-gray-100"><span className="text-gray-600">Subtotal</span><span className="font-mono">{formatCOP(orden.subtotal)}</span></div>
          <div className="flex justify-between py-1 border-b border-gray-100"><span className="text-gray-600">IVA</span><span className="font-mono">{formatCOP(orden.total_iva)}</span></div>
          <div className="flex justify-between font-bold py-2 border-t-2 border-gray-800 mt-1"><span>TOTAL</span><span className="font-mono text-orange-700">{formatCOP(orden.total)}</span></div>
        </div>
      </div>

      {orden.observaciones && <p className="text-sm text-gray-500 italic px-1">{orden.observaciones}</p>}
    </div>
  )
}
