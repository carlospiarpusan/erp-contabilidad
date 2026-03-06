export interface StockLike {
  cantidad?: number | null
  cantidad_minima?: number | null
}

export function isLowStockValue(cantidad: number, cantidadMinima: number) {
  return cantidad <= 0 || (cantidadMinima > 0 && cantidad <= cantidadMinima)
}

export function isLowStock(stock: StockLike) {
  return isLowStockValue(Number(stock.cantidad ?? 0), Number(stock.cantidad_minima ?? 0))
}

export function hasLowStock(stocks?: StockLike[] | null) {
  if (!stocks || stocks.length === 0) return true
  return stocks.some(isLowStock)
}
