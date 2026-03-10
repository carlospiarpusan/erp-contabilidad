export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { ChevronLeft, PencilLine } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FormAsientoManual } from '@/components/contabilidad/FormAsientoManual'

export default async function EditarAsientoManualPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: asiento }, { data: cuentas }] = await Promise.all([
    supabase
      .from('asientos')
      .select(`
        id, fecha, concepto, tipo, tipo_doc,
        lineas:asientos_lineas(cuenta_id, descripcion, debe, haber)
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('cuentas_puc')
      .select('id, codigo, descripcion')
      .eq('activa', true)
      .order('codigo'),
  ])

  if (!asiento || asiento.tipo !== 'manual') notFound()

  const lineas = ((asiento.lineas ?? []) as Array<{
    cuenta_id: string
    descripcion?: string | null
    debe: number
    haber: number
  }>).map((l) => ({
    cuenta_id: l.cuenta_id,
    descripcion: l.descripcion ?? '',
    debe: Number(l.debe ?? 0),
    haber: Number(l.haber ?? 0),
  }))

  return (
    <div className="flex flex-col gap-5">
      <Link href="/contabilidad/asientos" className="inline-flex w-fit items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Volver a asientos
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
          <PencilLine className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Editar asiento #{asiento.id.slice(0, 8)}
          </h1>
          <p className="text-sm text-gray-500">Actualiza fecha, concepto y líneas del asiento manual.</p>
        </div>
      </div>

      <FormAsientoManual
        cuentas={(cuentas ?? []) as { id: string; codigo: string; descripcion: string }[]}
        initial={{
          id: asiento.id,
          fecha: String(asiento.fecha),
          concepto: String(asiento.concepto ?? ''),
          lineas: lineas.length ? lineas : [{ cuenta_id: '', descripcion: '', debe: 0, haber: 0 }, { cuenta_id: '', descripcion: '', debe: 0, haber: 0 }],
        }}
      />
    </div>
  )
}
