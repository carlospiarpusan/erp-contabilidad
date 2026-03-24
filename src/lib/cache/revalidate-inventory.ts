import { revalidatePath, revalidateTag } from 'next/cache'
import {
  getInventarioStatsTag,
  getReportTag,
  getStockBajoTag,
  getVentasStatsTag,
} from '@/lib/cache/empresa-tags'

type RevalidateInventoryOptions = {
  includeVentasStats?: boolean
  productoId?: string
}

const INVENTORY_RELATED_PATHS = [
  '/',
  '/compras/facturas',
  '/compras/sugeridos',
  '/inventario/ajuste',
  '/inventario/kardex',
  '/productos',
  '/productos/stock-bajo',
  '/productos/sin-rotacion',
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

  if (options?.productoId) {
    revalidatePath(`/productos/${options.productoId}`)
  }

  for (const path of INVENTORY_RELATED_PATHS) {
    revalidatePath(path)
  }
}
