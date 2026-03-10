import { NextRequest, NextResponse } from 'next/server'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { getClientes } from '@/lib/db/clientes'
import { getProductos } from '@/lib/db/productos'
import { getFacturas } from '@/lib/db/ventas'
import { getProveedores } from '@/lib/db/compras'
import { toErrorMsg } from '@/lib/utils/errors'
import { normalizeSearchTerm } from '@/lib/utils/search'

type SearchItem = {
  tipo: 'cliente' | 'producto' | 'factura' | 'proveedor'
  id: string
  titulo: string
  detalle: string
  href: string
}

type FacturaSearchRow = {
  id: string
  numero?: number | null
  prefijo?: string | null
  total?: number | null
  cliente?: { razon_social?: string | null } | null
}

type ProveedorSearchRow = {
  id: string
  razon_social?: string | null
  numero_documento?: string | null
}

function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const q = normalizeSearchTerm(req.nextUrl.searchParams.get('q') ?? req.nextUrl.searchParams.get('busqueda'))
    if (q.length < 2) return NextResponse.json({ items: [] satisfies SearchItem[] })

    const puedeVerCompras = puedeAcceder(session.rol, 'compras')

    const [clientesRes, productosRes, facturasRes, proveedoresRes] = await Promise.all([
      getClientes({ busqueda: q, limit: 5, select_mode: 'selector', include_total: false }),
      getProductos({ busqueda: q, limit: 5, select_mode: 'selector', include_total: false }),
      getFacturas({ busqueda: q, limit: 5, offset: 0 }),
      puedeVerCompras
        ? getProveedores({ busqueda: q, limit: 5, select_mode: 'selector', include_total: false })
        : Promise.resolve({ proveedores: [], total: 0 }),
    ])

    const items: SearchItem[] = [
      ...(clientesRes.clientes ?? []).map((cliente) => ({
        tipo: 'cliente' as const,
        id: cliente.id,
        titulo: cliente.razon_social ?? 'Cliente',
        detalle: cliente.numero_documento
          ? `${cliente.numero_documento}${cliente.telefono ? ` · ${cliente.telefono}` : ''}`
          : (cliente.email ?? 'Cliente'),
        href: `/clientes/${cliente.id}`,
      })),
      ...(productosRes.productos ?? []).map((producto) => ({
        tipo: 'producto' as const,
        id: producto.id,
        titulo: producto.descripcion ?? 'Producto',
        detalle: producto.codigo ?? 'Producto',
        href: `/productos/${producto.id}`,
      })),
      ...((facturasRes.facturas ?? []) as FacturaSearchRow[]).map((factura) => ({
        tipo: 'factura' as const,
        id: factura.id,
        titulo: `Factura ${(factura.prefijo ?? '')}${factura.numero ?? ''}`.trim(),
        detalle: `${factura.cliente?.razon_social ?? 'Sin cliente'} · ${formatCOP(Number(factura.total ?? 0))}`,
        href: `/ventas/facturas/${factura.id}`,
      })),
      ...((proveedoresRes.proveedores ?? []) as ProveedorSearchRow[]).map((proveedor) => ({
        tipo: 'proveedor' as const,
        id: proveedor.id,
        titulo: proveedor.razon_social ?? 'Proveedor',
        detalle: proveedor.numero_documento ?? 'Proveedor',
        href: `/compras/proveedores/${proveedor.id}`,
      })),
    ]

    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
