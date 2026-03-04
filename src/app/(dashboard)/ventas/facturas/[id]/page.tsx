export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getFacturaById } from '@/lib/db/ventas'
import { getFormasPago } from '@/lib/db/maestros'
import { DetalleFactura } from '@/components/ventas/DetalleFactura'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

interface PageProps { params: Promise<{ id: string }> }

export default async function DetalleFacturaPage({ params }: PageProps) {
  const { id } = await params
  const [factura, formasPago] = await Promise.all([
    getFacturaById(id).catch(() => null),
    getFormasPago(),
  ])

  if (!factura) notFound()

  return (
    <div className="flex flex-col gap-4">
      <Link href="/ventas/facturas" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 w-fit">
        <ChevronLeft className="h-4 w-4" /> Volver a facturas
      </Link>
      <DetalleFactura factura={factura} formasPago={formasPago} />
    </div>
  )
}
