'use client'

import type { Bodega, Impuesto } from '@/types'
import { RemoteSalesDocumentForm } from '@/components/shared/RemoteSalesDocumentForm'

interface Props {
  impuestos: Impuesto[]
  bodegas: Bodega[]
}

const en15 = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)

export function FormPedido({ impuestos, bodegas }: Props) {
  return (
    <RemoteSalesDocumentForm
      endpoint="/api/ventas/pedidos"
      successPath={(id) => `/ventas/pedidos/${id}`}
      submitLabel="Crear pedido"
      theme="purple"
      dueDateLabel="Entrega estimada"
      dueDateDefault={en15}
      observationsPlaceholder="Instrucciones de entrega, notas..."
      impuestos={impuestos}
      bodegas={bodegas}
    />
  )
}
