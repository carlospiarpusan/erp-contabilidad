export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { DetalleServicio } from '@/components/servicios/DetalleServicio'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface PageProps { params: Promise<{ id: string }> }

export default async function ServicioPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('servicios_tecnicos')
    .select('*, cliente:cliente_id(id, razon_social, numero_documento, email, telefono)')
    .eq('id', id).single()

  if (error || !data) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href="/ventas/servicios" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Servicio Técnico
        </Link>
      </div>
      <DetalleServicio servicio={data as never} />
    </div>
  )
}
