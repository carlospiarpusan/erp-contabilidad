export const dynamic = 'force-dynamic'

import { getRemisionById } from '@/lib/db/remisiones'
import { getFormasPago } from '@/lib/db/maestros'
import { DetalleRemision } from '@/components/remisiones/DetalleRemision'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface PageProps { params: Promise<{ id: string }> }

export default async function RemisionPage({ params }: PageProps) {
  const { id } = await params
  const [remision, formasPago] = await Promise.all([
    getRemisionById(id).catch(() => null),
    getFormasPago(),
  ])
  if (!remision) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href="/ventas/remisiones" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Remisiones
        </Link>
      </div>
      <DetalleRemision remision={remision as any} formasPago={formasPago as any} />
    </div>
  )
}
