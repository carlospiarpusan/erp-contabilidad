export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Truck } from 'lucide-react'
import { FormTransportadoras } from '@/components/configuracion/FormTransportadoras'

const EMPRESA_ID = '00000000-0000-0000-0000-000000000001'

export default async function TransportadorasPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('transportadoras')
    .select('id, nombre, whatsapp, url_rastreo, activa')
    .eq('empresa_id', EMPRESA_ID)
    .order('nombre')

  const transportadoras = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
          <Truck className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Transportadoras</h1>
          <p className="text-sm text-gray-500">Empresas de transporte y mensajería</p>
        </div>
      </div>

      <FormTransportadoras transportadoras={transportadoras} />
    </div>
  )
}
