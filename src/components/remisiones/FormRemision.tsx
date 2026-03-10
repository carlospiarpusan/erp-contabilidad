'use client'

import type { Bodega, Impuesto } from '@/types'
import { RemoteSalesDocumentForm } from '@/components/shared/RemoteSalesDocumentForm'

interface Props {
  impuestos: Impuesto[]
  bodegas: Bodega[]
}

const en7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

export function FormRemision({ impuestos, bodegas }: Props) {
  return (
    <RemoteSalesDocumentForm
      endpoint="/api/ventas/remisiones"
      successPath={(id) => `/ventas/remisiones/${id}`}
      submitLabel="Crear remision"
      theme="cyan"
      dueDateLabel="Fecha de entrega"
      dueDateDefault={en7}
      observationsPlaceholder="Instrucciones de despacho, direccion de entrega..."
      impuestos={impuestos}
      bodegas={bodegas}
    />
  )
}
