'use client'

import type { Bodega, Impuesto } from '@/types'
import { RemoteSalesDocumentForm } from '@/components/shared/RemoteSalesDocumentForm'

interface Props {
  impuestos: Impuesto[]
  bodegas: Bodega[]
}

const en30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

export function FormCotizacion({ impuestos, bodegas }: Props) {
  return (
    <RemoteSalesDocumentForm
      endpoint="/api/ventas/cotizaciones"
      successPath={(id) => `/ventas/cotizaciones/${id}`}
      submitLabel="Crear cotizacion"
      theme="green"
      dueDateDefault={en30}
      observationsPlaceholder="Condiciones, notas para el cliente..."
      impuestos={impuestos}
      bodegas={bodegas}
    />
  )
}
