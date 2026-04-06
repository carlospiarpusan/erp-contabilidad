import type { BillingProduct, BillingProductCode, BillingPayment } from './types'

export type FilteredPaymentRow = BillingPayment

interface ListPaymentsParams {
  product_code?: BillingProductCode
  tipo?: string
  desde?: string
  hasta?: string
  search?: string
  offset?: number
  limit?: number
}

export async function listBillingPaymentsFiltered(
  _params: ListPaymentsParams
): Promise<{ data: FilteredPaymentRow[]; total: number; sum_cop: number }> {
  return { data: [], total: 0, sum_cop: 0 }
}

export async function listBillingProducts(): Promise<BillingProduct[]> {
  return []
}
