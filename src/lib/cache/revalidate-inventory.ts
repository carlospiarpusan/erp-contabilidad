import { revalidatePath, revalidateTag } from 'next/cache'
import {
  getInventarioStatsTag,
  getReportTag,
  getStockBajoTag,
  getVentasStatsTag,
} from '@/lib/cache/empresa-tags'

type RevalidateInventoryOptions = {
  includeVentasStats?: boolean
}

const INVENTORY_RELATED_PATHS = [
  '/',
  '/compras/facturas',
  '/compras/sugeridos',
  '/inventario/kardex',
  '/productos',
  '/productos/stock-bajo',
  '/informes/articulos',
] as const

export function revalidateInventoryDependentViews(
  empresaId: string,
  options?: RevalidateInventoryOptions
) {
  revalidateTag(getInventarioStatsTag(empresaId), 'max')
  revalidateTag(getStockBajoTag(empresaId), 'max')
  revalidateTag(getReportTag(empresaId), 'max')

  if (options?.includeVentasStats) {
    revalidateTag(getVentasStatsTag(empresaId), 'max')
    revalidatePath('/ventas/facturas')
  }

  for (const path of INVENTORY_RELATED_PATHS) {
    revalidatePath(path)
  }
}
