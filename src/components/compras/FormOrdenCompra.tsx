'use client'

import type { Bodega, Impuesto } from '@/types'
import { RemotePurchaseDocumentForm } from '@/components/shared/RemotePurchaseDocumentForm'

interface Props {
  impuestos: Impuesto[]
  bodegas: Bodega[]
}

export function FormOrdenCompra({ impuestos, bodegas }: Props) {
  return (
    <RemotePurchaseDocumentForm
      endpoint="/api/compras/ordenes"
      successPath={(id) => `/compras/ordenes/${id}`}
      submitLabel="Crear orden"
      mode="orden"
      impuestos={impuestos}
      bodegas={bodegas}
    />
  )
}
