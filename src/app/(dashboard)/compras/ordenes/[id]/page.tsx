export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getOrdenCompraById } from '@/lib/db/cotizaciones'
import { DetalleOrden } from '@/components/compras/DetalleOrden'
import Link from 'next/link'

interface PageProps { params: Promise<{ id: string }> }

export default async function DetalleOrdenPage({ params }: PageProps) {
  const { id } = await params
  const orden = await getOrdenCompraById(id).catch(() => null)
  if (!orden) notFound()

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-gray-500">
        <Link href="/compras/ordenes" className="hover:text-gray-700">← Órdenes de Compra</Link>
      </div>
      <DetalleOrden orden={orden as unknown as Parameters<typeof DetalleOrden>[0]['orden']} />
    </div>
  )
}
