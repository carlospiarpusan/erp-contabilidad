export const dynamic = 'force-dynamic'

import { AlertTriangle } from 'lucide-react'
import { getRegulatoryConfig, getUvtVigencias, listJobs } from '@/lib/db/compliance'
import { FormRegulacion } from '@/components/configuracion/FormRegulacion'

export default async function RegulacionPage() {
  const [config, uvts, jobs] = await Promise.all([
    getRegulatoryConfig(),
    getUvtVigencias(),
    listJobs(20).catch(() => []),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
          <AlertTriangle className="h-5 w-5 text-amber-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Regulación y cumplimiento</h1>
          <p className="text-sm text-gray-500">Perfil regulatorio, UVT, soporte documental y validaciones operativas.</p>
        </div>
      </div>

      <FormRegulacion config={config} uvts={uvts} jobs={jobs} />
    </div>
  )
}
