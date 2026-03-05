export const dynamic = 'force-dynamic'

import { getProveedorById, getResumenProveedor } from '@/lib/db/compras'
import { notFound } from 'next/navigation'
import { formatCOP, formatFecha } from '@/utils/cn'
import {
  Truck, Phone, Mail, MapPin, Building2, User,
  TrendingDown, ShoppingCart, CreditCard, FileText, CheckCircle2, Clock
} from 'lucide-react'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  pagada:    'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
  parcial:   'bg-blue-100 text-blue-700',
}

export default async function DetalleProveedorPage({ params }: Props) {
  const { id } = await params

  const [proveedor, resumen] = await Promise.all([
    getProveedorById(id).catch(() => null),
    getResumenProveedor(id).catch(() => null),
  ])

  if (!proveedor) notFound()

  const kpis = [
    { label: 'Total facturas',   valor: String(resumen?.total_facturas ?? 0),   icon: ShoppingCart,  color: 'bg-orange-50 text-orange-700' },
    { label: 'Total comprado',   valor: formatCOP(resumen?.total_compras ?? 0),  icon: TrendingDown,  color: 'bg-red-50 text-red-700'       },
    { label: 'Saldo pendiente',  valor: formatCOP(resumen?.saldo_pendiente ?? 0), icon: CreditCard,   color: (resumen?.saldo_pendiente ?? 0) > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500' },
  ]

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/compras/proveedores" className="hover:text-gray-700">← Proveedores</Link>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700 text-xl font-bold shadow-sm">
              {proveedor.razon_social.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{proveedor.razon_social}</h1>
              {proveedor.numero_documento && (
                <p className="text-sm font-mono text-gray-500 mt-0.5">
                  {proveedor.tipo_documento ?? 'NIT'}: {proveedor.numero_documento}{proveedor.dv ? `-${proveedor.dv}` : ''}
                </p>
              )}
              <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${proveedor.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {proveedor.activo ? <><CheckCircle2 className="h-3 w-3" /> Activo</> : <><Clock className="h-3 w-3" /> Inactivo</>}
              </span>
            </div>
          </div>
          <Link href={`/compras/facturas?proveedor_id=${proveedor.id}`}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Ver compras →
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.color}`}>
              <k.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{k.valor}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Datos empresa */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" /> Datos del proveedor
          </h2>
          <dl className="space-y-3 text-sm">
            {proveedor.contacto && (
              <div className="flex items-center gap-2 text-gray-600">
                <User className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{proveedor.contacto}</span>
              </div>
            )}
            {proveedor.telefono && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                <a href={`tel:${proveedor.telefono}`} className="hover:text-blue-600">{proveedor.telefono}</a>
              </div>
            )}
            {proveedor.email && (
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                <a href={`mailto:${proveedor.email}`} className="hover:text-blue-600 break-all">{proveedor.email}</a>
              </div>
            )}
            {(proveedor.ciudad || proveedor.departamento || proveedor.direccion) && (
              <div className="flex items-start gap-2 text-gray-600">
                <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  {proveedor.direccion && <p>{proveedor.direccion}</p>}
                  {(proveedor.ciudad || proveedor.departamento) && (
                    <p className="text-gray-400 text-xs">{[proveedor.ciudad, proveedor.departamento].filter(Boolean).join(', ')}</p>
                  )}
                </div>
              </div>
            )}
            {proveedor.observaciones && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Observaciones</p>
                <p className="text-gray-600 italic">{proveedor.observaciones}</p>
              </div>
            )}
          </dl>
        </div>

        {/* Últimas compras */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-gray-400" /> Últimas facturas de compra
          </h2>
          {(resumen?.ultimas_facturas ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin compras registradas</p>
          ) : (
            <div className="space-y-2">
              {(resumen?.ultimas_facturas ?? []).map(f => (
                <Link key={f.id} href={`/compras/facturas/${f.id}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors group">
                  <div>
                    <p className="font-mono text-sm font-medium text-gray-700 group-hover:text-orange-600">
                      {f.prefijo}{f.numero}
                    </p>
                    <p className="text-xs text-gray-400">{formatFecha(f.fecha)}</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_BADGE[f.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                      {f.estado}
                    </span>
                    <span className="font-mono text-sm font-semibold text-gray-900">{formatCOP(f.total)}</span>
                  </div>
                </Link>
              ))}
              <div className="pt-2 border-t border-gray-100">
                <Link href={`/compras/facturas?proveedor_id=${proveedor.id}`}
                  className="text-xs text-orange-600 hover:underline">
                  Ver todas las compras →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
