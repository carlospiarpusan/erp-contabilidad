import { HttpError } from '@/lib/utils/errors'

export type DocumentoCancelableTipo = 'factura_venta' | 'factura_compra' | 'gasto'

export interface DocumentoCancelacionState {
  tipo: DocumentoCancelableTipo
  estado?: string | null
  recibosCount?: number
  asientosCount?: number
  stockMovimientosCount?: number
}

export function getCancelacionContableError(input: DocumentoCancelacionState): HttpError | null {
  if (input.estado === 'cancelada') return null

  const recibos = Number(input.recibosCount ?? 0)
  const asientos = Number(input.asientosCount ?? 0)
  const stockMovimientos = Number(input.stockMovimientosCount ?? 0)

  if (recibos > 0) {
    if (input.tipo === 'factura_venta') {
      return new HttpError(
        'La factura ya tiene pagos registrados. Primero debes revertir o regularizar los recaudos y luego corregirla con una nota crédito.',
        409,
        'documento_con_pagos'
      )
    }

    if (input.tipo === 'factura_compra') {
      return new HttpError(
        'La compra ya tiene pagos aplicados. Primero debes revertir los pagos y luego hacer la corrección contable correspondiente.',
        409,
        'documento_con_pagos'
      )
    }
  }

  if (stockMovimientos > 0 || asientos > 0) {
    if (input.tipo === 'factura_venta') {
      return new HttpError(
        'La factura de venta ya afectó inventario y contabilidad. No debe cancelarse directamente; emite una nota crédito para conservar la trazabilidad.',
        409,
        'documento_posteado'
      )
    }

    if (input.tipo === 'factura_compra') {
      return new HttpError(
        'La factura de compra ya afectó inventario y contabilidad. No debe cancelarse directamente; usa la reversión contable y el ajuste de inventario que corresponda.',
        409,
        'documento_posteado'
      )
    }

    return new HttpError(
      'El gasto ya quedó contabilizado. No debe cancelarse directamente; utiliza una reversión contable para corregirlo sin perder la trazabilidad.',
      409,
      'documento_posteado'
    )
  }

  return null
}

export function assertDocumentoCancelable(input: DocumentoCancelacionState) {
  const error = getCancelacionContableError(input)
  if (error) throw error
}
