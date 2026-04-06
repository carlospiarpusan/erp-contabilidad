export type BillingProductCode = string

export interface BillingProduct {
  product_code: BillingProductCode
  nombre: string
}

export interface BillingPayment {
  id: string
  empresa_id: string
  product_code: BillingProductCode
  tipo: string
  billing_interval: string | null
  valor_cop: number
  fecha: string
  referencia_externa: string | null
  transaction_id: string | null
}
