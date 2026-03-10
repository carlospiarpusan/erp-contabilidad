export function getVentasStatsTag(empresaId: string) {
  return `ventas-stats:${empresaId}`
}

export function getInventarioStatsTag(empresaId: string) {
  return `inventario-stats:${empresaId}`
}

export function getStockBajoTag(empresaId: string) {
  return `stock-bajo:${empresaId}`
}

export function getReportTag(empresaId: string) {
  return `report:${empresaId}`
}

export function getReportScopeTag(empresaId: string, scope: string) {
  return `report:${empresaId}:${scope}`
}
