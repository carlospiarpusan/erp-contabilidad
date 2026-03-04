export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getCotizacionById } from '@/lib/db/cotizaciones'
import { getFormasPago } from '@/lib/db/maestros'
import { DetalleCotizacion } from '@/components/cotizaciones/DetalleCotizacion'
import Link from 'next/link'

interface PageProps { params: Promise<{ id: string }> }

export default async function DetalleCotizacionPage({ params }: PageProps) {
  const { id } = await params
  const [cotizacion, formasPago] = await Promise.all([
    getCotizacionById(id).catch(() => null),
    getFormasPago(),
  ])
  if (!cotizacion) notFound()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/ventas/cotizaciones" className="hover:text-gray-700">← Cotizaciones</Link>
      </div>
      <DetalleCotizacion
        cotizacion={cotizacion as unknown as Parameters<typeof DetalleCotizacion>[0]['cotizacion']}
        formasPago={formasPago as unknown as Parameters<typeof DetalleCotizacion>[0]['formasPago']}
      />
    </div>
  )
}
