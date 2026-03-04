export const dynamic = 'force-dynamic'

import { getRecibos } from '@/lib/db/ventas'
import { Tabla, FilaTabla, CeldaTabla } from '@/components/ui/tabla'
import { formatCOP, formatFecha } from '@/utils/cn'
import { Receipt } from 'lucide-react'
import Link from 'next/link'

export default async function RecibosPage() {
  const { recibos, total } = await getRecibos({ limit: 100 })

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
          <Receipt className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Recibos de caja</h1>
          <p className="text-sm text-gray-500">{total} recibo{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <Tabla columnas={[
        { key: 'numero',   label: 'N° Recibo' },
        { key: 'fecha',    label: 'Fecha' },
        { key: 'factura',  label: 'Factura' },
        { key: 'cliente',  label: 'Cliente' },
        { key: 'pago',     label: 'Forma de pago' },
        { key: 'valor',    label: 'Valor', className: 'text-right' },
      ]}>
        {recibos.length === 0 ? (
          <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No hay recibos registrados</td></tr>
        ) : recibos.map(r => (
          <FilaTabla key={r.id}>
            <CeldaTabla><span className="font-mono text-sm text-gray-600">{r.numero}</span></CeldaTabla>
            <CeldaTabla><span className="text-sm text-gray-700">{formatFecha(r.fecha)}</span></CeldaTabla>
            <CeldaTabla>
              {(r.documento as { id?: string; prefijo?: string; numero?: number } | null)?.id ? (
                <Link
                  href={`/ventas/facturas/${(r.documento as { id: string }).id}`}
                  className="text-blue-600 hover:underline font-mono text-sm"
                >
                  {(r.documento as { prefijo?: string; numero?: number }).prefijo}{(r.documento as { numero?: number }).numero}
                </Link>
              ) : '—'}
            </CeldaTabla>
            <CeldaTabla>
              <span className="text-sm text-gray-700">
                {(r.documento as { cliente?: { razon_social?: string } } | null)?.cliente?.razon_social ?? '—'}
              </span>
            </CeldaTabla>
            <CeldaTabla>
              <span className="text-sm text-gray-500">
                {(r.forma_pago as { descripcion?: string } | null)?.descripcion ?? '—'}
              </span>
            </CeldaTabla>
            <CeldaTabla className="text-right font-mono font-medium text-green-700">
              {formatCOP(r.valor)}
            </CeldaTabla>
          </FilaTabla>
        ))}
      </Tabla>
    </div>
  )
}
