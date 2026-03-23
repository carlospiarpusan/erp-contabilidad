import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { createExportResponse, resolveExportFormat } from '@/lib/utils/csv'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const format = resolveExportFormat(searchParams.get('format'))
    const supabase = await createClient()
    const pageSize = 500

    async function* rows() {
      let offset = 0

      while (true) {
        const { data, error } = await supabase
          .from('productos')
          .select('codigo, codigo_barras, descripcion, precio_venta, precio_venta2, precio_compra, unidad_medida, activo, familia:familia_id(nombre, descripcion), impuesto:impuestos(codigo, descripcion, porcentaje), stock(cantidad, cantidad_minima)')
          .order('descripcion')
          .range(offset, offset + pageSize - 1)

        if (error) throw error

        const batch = data ?? []
        if (!batch.length) break

        for (const row of batch) {
          const familia = row.familia as { nombre?: string; descripcion?: string } | null
          const impuesto = row.impuesto as { codigo?: string; descripcion?: string; porcentaje?: number } | null
          const stocks = Array.isArray(row.stock) ? row.stock : []
          const stockActual = stocks.reduce((sum, stock) => sum + Number(stock.cantidad ?? 0), 0)
          const stockMinimo = stocks.reduce((sum, stock) => sum + Number(stock.cantidad_minima ?? 0), 0)
          const impuestoExport = impuesto?.codigo
            ? impuesto.codigo
            : (impuesto?.porcentaje ?? null) != null
                ? `${impuesto?.porcentaje}%`
                : (impuesto?.descripcion ?? '')

          yield [
            row.codigo ?? '',
            row.codigo_barras ?? '',
            row.descripcion ?? '',
            familia?.descripcion ?? familia?.nombre ?? '',
            row.unidad_medida ?? '',
            row.precio_venta ?? 0,
            row.precio_venta2 ?? 0,
            row.precio_compra ?? 0,
            impuestoExport,
            stockActual,
            stockMinimo,
            row.activo ? 'Sí' : 'No',
          ]
        }

        if (batch.length < pageSize) break
        offset += pageSize
      }
    }

    return createExportResponse({
      format,
      baseFilename: `inventario-${new Date().toISOString().split('T')[0]}`,
      headers: ['Código', 'Código de barras', 'Descripción', 'Familia', 'Unidad', 'Precio Venta', 'Precio Mayorista', 'Precio Compra', 'IVA', 'Stock Actual', 'Stock Mínimo', 'Activo'],
      rows: rows(),
      sheetName: 'Inventario',
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
