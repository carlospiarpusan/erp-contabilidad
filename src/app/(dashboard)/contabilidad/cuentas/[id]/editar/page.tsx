export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { ChevronLeft, SquarePen } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FormCuentaPUC } from '@/components/contabilidad/FormCuentaPUC'

export default async function EditarCuentaPUCPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: cuenta }, { data: cuentasPadre }] = await Promise.all([
    supabase
      .from('cuentas_puc')
      .select('id, codigo, descripcion, tipo, nivel, naturaleza, cuenta_padre_id, activa')
      .eq('id', id)
      .single(),
    supabase
      .from('cuentas_puc')
      .select('id, codigo, descripcion')
      .eq('activa', true)
      .neq('id', id)
      .order('codigo'),
  ])

  if (!cuenta) notFound()

  return (
    <div className="flex flex-col gap-5">
      <Link href="/contabilidad/cuentas" className="inline-flex w-fit items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Volver a cuentas
      </Link>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <SquarePen className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Editar cuenta PUC</h1>
          <p className="text-sm text-gray-500">Actualiza estructura y naturaleza de la cuenta.</p>
        </div>
      </div>
      <FormCuentaPUC
        inicial={{
          id: cuenta.id,
          codigo: cuenta.codigo ?? '',
          descripcion: cuenta.descripcion ?? '',
          tipo: cuenta.tipo ?? 'activo',
          nivel: Number(cuenta.nivel ?? 4),
          naturaleza: (cuenta.naturaleza === 'credito' ? 'credito' : 'debito') as 'debito' | 'credito',
          cuenta_padre_id: (cuenta.cuenta_padre_id as string | null) ?? null,
          activa: cuenta.activa !== false,
        }}
        cuentasPadre={(cuentasPadre ?? []) as { id: string; codigo: string; descripcion: string }[]}
      />
    </div>
  )
}
