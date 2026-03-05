export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { DetalleGarantia } from '@/components/garantias/DetalleGarantia'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface PageProps { params: Promise<{ id: string }> }

export default async function GarantiaPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('garantias')
    .select('*, cliente:cliente_id(id, razon_social, numero_documento, email, telefono), producto:producto_id(id, codigo, descripcion), documento:documento_venta_id(id, prefijo, numero)')
    .eq('id', id).single()

  if (error || !data) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href="/ventas/garantias" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Garantías
        </Link>
      </div>
      <DetalleGarantia garantia={data as never} />
    </div>
  )
}
