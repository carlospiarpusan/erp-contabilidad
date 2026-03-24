export const dynamic = 'force-dynamic'

import { CalendarRange } from 'lucide-react'
import { getEjerciciosAll } from '@/lib/db/contabilidad'
import { getPeriodosContables } from '@/lib/db/compliance'
import { GestionPeriodosContables } from '@/components/contabilidad/GestionPeriodosContables'

export default async function PeriodosContablesPage() {
  const [ejercicios, periodos] = await Promise.all([
    getEjerciciosAll(),
    getPeriodosContables(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <CalendarRange className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Periodos contables</h1>
          <p className="text-sm text-gray-500">Cierre mensual, reapertura controlada y bloqueo transversal de escrituras.</p>
        </div>
      </div>

      <GestionPeriodosContables ejercicios={ejercicios} periodos={periodos as unknown as Parameters<typeof GestionPeriodosContables>[0]['periodos']} />
    </div>
  )
}
