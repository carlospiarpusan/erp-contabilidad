'use client'

import Link from 'next/link'

export default function CompraDetalleError() {
  return (
    <div className="max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6">
      <h1 className="text-lg font-bold text-red-900">No fue posible cargar la factura de compra</h1>
      <p className="mt-2 text-sm text-red-800">
        La factura pudo haberse creado correctamente, pero una carga secundaria del detalle falló.
      </p>
      <p className="mt-1 text-sm text-red-800">
        Vuelve a intentar o regresa al listado de compras para abrirla otra vez.
      </p>
      <div className="mt-4 flex gap-4">
        <Link href="/compras/facturas" className="text-sm font-medium text-red-900 underline">
          Volver a compras
        </Link>
        <Link href="/" className="text-sm font-medium text-red-900 underline">
          Ir al dashboard
        </Link>
      </div>
    </div>
  )
}
