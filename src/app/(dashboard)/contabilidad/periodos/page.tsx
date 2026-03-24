export const dynamic = 'force-dynamic'

import { CalendarRange } from 'lucide-react'
import { getEjerciciosAll } from '@/lib/db/contabilidad'
import { getPeriodosContables } from '@/lib/db/compliance'
import { GestionPeriodosContables } from '@/components/contabilidad/GestionPeriodosContables'

export default async function PeriodosContablesPage() {
  let ejercicios: Awaited<ReturnType<typeof getEjerciciosAll>> = []
  let periodos: Awaited<ReturnType<typeof getPeriodosContables>> = []
  let loadError: string | null = null

  try {
    ;[ejercicios, periodos] = await Promise.all([
      getEjerciciosAll(),
      getPeriodosContables(),
    ])
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Error al cargar periodos contables'
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <CalendarRange className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Periodos contables</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Cierre mensual, reapertura controlada y bloqueo transversal de escrituras.</p>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {loadError}
        </div>
      ) : (
        <GestionPeriodosContables ejercicios={ejercicios} periodos={periodos as unknown as Parameters<typeof GestionPeriodosContables>[0]['periodos']} />
      )}
    </div>
  )
}
