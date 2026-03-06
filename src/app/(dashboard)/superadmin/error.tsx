'use client'

import Link from 'next/link'

export default function SuperadminError() {
  return (
    <div className="max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6">
      <h1 className="text-lg font-bold text-red-900">Error cargando Superadmin</h1>
      <p className="mt-2 text-sm text-red-800">
        Ocurrió un error del servidor en el módulo superadmin.
      </p>
      <p className="mt-1 text-sm text-red-800">
        Verifica variables de entorno en Vercel y vuelve a intentar.
      </p>
      <div className="mt-4">
        <Link href="/" className="text-sm font-medium text-red-900 underline">
          Volver al dashboard
        </Link>
      </div>
    </div>
  )
}
