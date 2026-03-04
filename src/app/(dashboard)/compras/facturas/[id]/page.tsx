export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getCompraById } from '@/lib/db/compras'
import { getFormasPago } from '@/lib/db/maestros'
import { DetalleCompra } from '@/components/compras/DetalleCompra'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

interface PageProps { params: Promise<{ id: string }> }

export default async function DetalleCompraPage({ params }: PageProps) {
  const { id } = await params
  const [compra, formasPago] = await Promise.all([
    getCompraById(id).catch(() => null),
    getFormasPago(),
  ])

  if (!compra) notFound()

  return (
    <div className="flex flex-col gap-4">
      <Link href="/compras/facturas" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 w-fit">
        <ChevronLeft className="h-4 w-4" /> Volver a compras
      </Link>
      <DetalleCompra compra={compra as unknown as Parameters<typeof DetalleCompra>[0]['compra']} formasPago={formasPago} />
    </div>
  )
}
