export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
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
    <div className="flex flex-col gap-6 max-w-5xl">
      <FormFacturacionElectronica config={data} />
    </div>
  )
}
