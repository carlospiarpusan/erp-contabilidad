export const dynamic = 'force-dynamic'

import { getHistorialImportaciones } from '@/lib/db/importaciones'
import { getSession } from '@/lib/auth/session'
import { normalizeImportEntity, type ImportEntity } from '@/lib/import/migration'
import { CentroMigracion } from '@/components/configuracion/CentroMigracion'

interface ImportarPageProps {
  searchParams: Promise<{ entidad?: ImportEntity }>
}

export default async function ImportarPage({ searchParams }: ImportarPageProps) {
  const sp = await searchParams
  const entidad = normalizeImportEntity(sp.entidad)
  const [historial, session] = await Promise.all([
    getHistorialImportaciones(),
    getSession(),
  ])

  return <CentroMigracion initialEntidad={entidad} historial={historial} role={session?.rol ?? null} />
}
