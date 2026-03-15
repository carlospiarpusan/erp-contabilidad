export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { FileCheck } from 'lucide-react'
import { FormFacturacionElectronica } from '@/components/configuracion/FormFacturacionElectronica'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export default async function FacturacionElectronicaPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = await createClient()
  const { data } = await supabase
    .from('configuracion_fe')
    .select('activa, ambiente, auth_token, account_id, prefijo, resolucion, fecha_resolucion, rango_desde, rango_hasta, send_dian, send_email, email_copia')
    .eq('empresa_id', session.empresa_id)
    .maybeSingle()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
          <FileCheck className="h-5 w-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Facturación Electrónica</h1>
          <p className="text-sm text-gray-500">Conexión con Dataico para emisión de facturas electrónicas ante la DIAN</p>
        </div>
      </div>

      <FormFacturacionElectronica config={data} />
    </div>
  )
}
