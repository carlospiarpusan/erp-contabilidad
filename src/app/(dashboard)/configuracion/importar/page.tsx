export const dynamic = 'force-dynamic'

import { Upload } from 'lucide-react'
import { ImportarCSV } from '@/components/configuracion/ImportarCSV'

export default function ImportarPage() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
          <Upload className="h-5 w-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Importar datos</h1>
          <p className="text-sm text-gray-500">Carga masiva de clientes, proveedores y productos desde CSV</p>
        </div>
      </div>

      <ImportarCSV />
    </div>
  )
}
