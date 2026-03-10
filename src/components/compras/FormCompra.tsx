'use client'

import type { Bodega, Impuesto } from '@/types'
import { RemotePurchaseDocumentForm } from '@/components/shared/RemotePurchaseDocumentForm'

interface Props {
  impuestos: Impuesto[]
  bodegas: Bodega[]
}

export function FormCompra({ impuestos, bodegas }: Props) {
  return (
    <RemotePurchaseDocumentForm
      endpoint="/api/compras/facturas"
      successPath={(id) => `/compras/facturas/${id}`}
      submitLabel="Registrar compra"
      mode="compra"
      impuestos={impuestos}
      bodegas={bodegas}
    />
  )
}
