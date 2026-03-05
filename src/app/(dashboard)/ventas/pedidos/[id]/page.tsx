export const dynamic = 'force-dynamic'

import { getPedidoById } from '@/lib/db/pedidos'
import { getFormasPago } from '@/lib/db/maestros'
import { DetallePedido } from '@/components/pedidos/DetallePedido'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface PageProps { params: Promise<{ id: string }> }

export default async function PedidoPage({ params }: PageProps) {
  const { id } = await params
  const [pedido, formasPago] = await Promise.all([
    getPedidoById(id).catch(() => null),
    getFormasPago(),
  ])
  if (!pedido) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href="/ventas/pedidos" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Pedidos
        </Link>
      </div>
      <DetallePedido pedido={pedido as any} formasPago={formasPago as any} />
    </div>
  )
}
