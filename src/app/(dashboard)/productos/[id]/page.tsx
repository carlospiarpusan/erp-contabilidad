export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { getProductoById, getMovimientosProducto, getFamilias, getFabricantes, getImpuestos, getBodegas } from '@/lib/db/productos'
import { DetalleProducto } from '@/components/productos/DetalleProducto'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

interface PageProps { params: Promise<{ id: string }> }

export default async function DetalleProductoPage({ params }: PageProps) {
  const { id } = await params

  const [session, producto, movimientos, bodegas, familias, fabricantes, impuestos] = await Promise.all([
    getSession(),
    getProductoById(id).catch(() => null),
    getMovimientosProducto(id),
    getBodegas(),
    getFamilias(),
    getFabricantes(),
    getImpuestos(),
  ])

  if (!producto) notFound()
  const canManage = session ? puedeAcceder(session.rol, 'productos', 'manage') : false

  return (
    <div className="flex flex-col gap-4">
      <Link href="/productos" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors w-fit">
        <ChevronLeft className="h-4 w-4" /> Volver a productos
      </Link>
      <DetalleProducto
        producto={producto}
        bodegas={bodegas}
        familias={familias}
        fabricantes={fabricantes}
        impuestos={impuestos}
        movimientos={movimientos}
        canManage={canManage}
      />
    </div>
  )
}
