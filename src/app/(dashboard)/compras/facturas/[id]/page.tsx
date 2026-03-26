export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getCompraById } from '@/lib/db/compras'
import { getFormasPago } from '@/lib/db/maestros'
import { DetalleCompra } from '@/components/compras/DetalleCompra'
import { getDocumentoSoporte, listAdjuntosPrivados } from '@/lib/db/compliance'
import { getUvtVigencias } from '@/lib/db/compliance'
import { getRetencionesActivas } from '@/lib/db/retenciones'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

interface PageProps { params: Promise<{ id: string }> }

export default async function DetalleCompraPage({ params }: PageProps) {
  const { id } = await params
  const [compraResult, formasPagoResult, documentoSoporteResult, adjuntosResult, retencionesResult, uvtsResult] = await Promise.allSettled([
    getCompraById(id),
    getFormasPago(),
    getDocumentoSoporte(id),
    listAdjuntosPrivados({ relationType: 'documento', relationId: id }),
    getRetencionesActivas('compras'),
    getUvtVigencias(),
  ])

  const compra = compraResult.status === 'fulfilled' ? compraResult.value : null
  const formasPago = formasPagoResult.status === 'fulfilled' ? formasPagoResult.value : []
  const documentoSoporte = documentoSoporteResult.status === 'fulfilled' ? documentoSoporteResult.value : null
  const adjuntos = adjuntosResult.status === 'fulfilled' ? adjuntosResult.value : []
  const retenciones = retencionesResult.status === 'fulfilled' ? retencionesResult.value : []
  const currentYear = new Date().getFullYear()
  const uvtValue = uvtsResult.status === 'fulfilled'
    ? (uvtsResult.value.find((item) => item.año === currentYear)?.valor ?? null)
    : null

  if (!compra) notFound()

  return (
    <div className="flex flex-col gap-4">
      <Link href="/compras/facturas" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 w-fit">
        <ChevronLeft className="h-4 w-4" /> Volver a compras
      </Link>
      <DetalleCompra
        compra={compra as unknown as Parameters<typeof DetalleCompra>[0]['compra']}
        formasPago={formasPago}
        documentoSoporte={documentoSoporte as Parameters<typeof DetalleCompra>[0]['documentoSoporte']}
        adjuntos={adjuntos as Parameters<typeof DetalleCompra>[0]['adjuntos']}
        retenciones={retenciones}
        uvtValue={uvtValue}
      />
    </div>
  )
}
