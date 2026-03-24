import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getExogenaPackage } from '@/lib/db/compliance'
import { createExportResponse, resolveExportFormat } from '@/lib/utils/csv'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get('año') ?? searchParams.get('anio') ?? new Date().getFullYear())
    const format = resolveExportFormat(searchParams.get('format'))
    const pkg = await getExogenaPackage(year)

    const rows = [
      ...Object.entries(pkg.validations).map(([key, value]) => ['validacion', key, value ?? '', '', '', '', '', '', '', '', '']),
      ...pkg.terceros.map((item) => [
        'tercero',
        item.tipo_tercero,
        item.tipo_documento ?? '',
        item.numero_documento ?? '',
        item.nombre ?? '',
        item.ciudad ?? '',
        item.departamento ?? '',
        item.email ?? '',
        item.telefono ?? '',
        item.activo ?? '',
        ('obligado_a_facturar' in item ? item.obligado_a_facturar : '') ?? '',
      ]),
      ...pkg.ventas.map((item) => [
        'venta',
        item.fecha,
        item.documento,
        item.tercero,
        item.tercero_documento,
        item.total,
        item.iva,
        item.descuento,
        '',
        '',
        '',
      ]),
      ...pkg.compras.map((item) => [
        'compra',
        item.fecha,
        item.documento,
        item.proveedor,
        item.nit_proveedor,
        item.total,
        item.iva,
        item.descuento,
        item.factura_proveedor,
        item.estado_soporte,
        '',
      ]),
      ...pkg.retenciones.map((item) => [
        'retencion',
        item.fecha,
        item.documento,
        item.tercero,
        item.tercero_documento,
        item.base_gravable,
        item.porcentaje,
        item.valor,
        item.retencion_tipo,
        item.retencion_nombre,
        '',
      ]),
      ...pkg.soportes_pendientes.map((item) => [
        'soporte_pendiente',
        item.fecha,
        item.documento,
        item.proveedor,
        item.nit_proveedor,
        item.total_compra,
        item.estado_soporte,
        item.numero_soporte,
        item.factura_proveedor,
        item.fecha_soporte,
        '',
      ]),
    ]

    return createExportResponse({
      format,
      baseFilename: `exogena-${year}`,
      headers: ['Sección', 'Campo 1', 'Campo 2', 'Campo 3', 'Campo 4', 'Campo 5', 'Campo 6', 'Campo 7', 'Campo 8', 'Campo 9', 'Campo 10'],
      rows,
      sheetName: 'Exogena',
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 })
  }
}
