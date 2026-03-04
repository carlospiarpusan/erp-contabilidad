export const dynamic = 'force-dynamic'

import { getEjerciciosAll } from '@/lib/db/contabilidad'
import { GestionEjercicios } from '@/components/contabilidad/GestionEjercicios'
import { CalendarRange } from 'lucide-react'

export default async function EjerciciosPage() {
  const ejercicios = await getEjerciciosAll()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <CalendarRange className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ejercicios contables</h1>
          <p className="text-sm text-gray-500">{ejercicios.length} ejercicio{ejercicios.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <GestionEjercicios ejercicios={ejercicios} />
    </div>
  )
}
