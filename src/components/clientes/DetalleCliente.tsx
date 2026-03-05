'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Cliente, GrupoCliente } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { FormCliente } from './FormCliente'
import { formatCOP } from '@/utils/cn'
import {
  Phone, Mail, MapPin, CreditCard, Building2, User,
  Pencil, ArrowLeft, MessageCircle, Tag, Calendar,
  TrendingUp, ShoppingCart, AlertCircle, CheckCircle2
} from 'lucide-react'
import Link from 'next/link'

interface Resumen {
  total_facturas:   number
  total_compras:    number
  total_cobrado:    number
  saldo_pendiente:  number
  ultimas_facturas: { id: string; numero: number; prefijo?: string; total: number; fecha: string; estado: string }[]
}

interface Props {
  cliente: Cliente
  grupos:  GrupoCliente[]
  resumen?: Resumen | null
}

function CreditoSemaforo({ limite, dias }: { limite?: number; dias?: number }) {
  if (!limite || limite === 0) return (
    <div className="flex items-center gap-2 text-gray-400">
      <AlertCircle className="h-4 w-4" />
      <span className="text-sm">Sin crédito habilitado</span>
    </div>
  )
  return (
    <div className="flex items-center gap-2 text-green-600">
      <CheckCircle2 className="h-4 w-4" />
      <span className="text-sm">Crédito habilitado — {dias ?? 30} días</span>
    </div>
  )
}

export function DetalleCliente({ cliente: init, grupos, resumen }: Props) {
  const router = useRouter()
  const [cliente, setCliente] = useState(init)
  const [modal, setModal]     = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function guardar(datos: Partial<Cliente>) {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/clientes/${cliente.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error); return }
    setCliente(data)
    setModal(false)
    router.refresh()
  }

  const grupo = cliente.grupo as { nombre: string; descuento_porcentaje?: number } | null

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clientes" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white text-xl font-bold shadow-md">
            {cliente.razon_social.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{cliente.razon_social}</h1>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-gray-500">
                {cliente.tipo_documento} {cliente.numero_documento}{cliente.dv ? `-${cliente.dv}` : ''}
              </span>
              <Badge variant={cliente.activo ? 'success' : 'danger'}>
                {cliente.activo ? 'Activo' : 'Inactivo'}
              </Badge>
              {grupo && (
                <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                  <Tag className="h-3 w-3" /> {grupo.nombre}
                  {(grupo.descuento_porcentaje ?? 0) > 0 && ` · ${grupo.descuento_porcentaje}% desc.`}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button onClick={() => setModal(true)}>
          <Pencil className="h-4 w-4 mr-2" /> Editar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total facturas',  valor: String(resumen?.total_facturas ?? 0),          icon: ShoppingCart, color: 'bg-blue-50 text-blue-700' },
          { label: 'Total facturado', valor: formatCOP(resumen?.total_compras ?? 0),         icon: TrendingUp,   color: 'bg-green-50 text-green-700' },
          { label: 'Saldo pendiente', valor: formatCOP(resumen?.saldo_pendiente ?? 0),       icon: CreditCard,   color: (resumen?.saldo_pendiente ?? 0) > 0 ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-500 dark:text-gray-400 dark:text-gray-500' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
            <div className={`mb-2 inline-flex rounded-lg p-2 ${k.color}`}>
              <k.icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{k.valor}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Datos generales */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" /> Datos de la empresa
          </h2>
          <dl className="space-y-2.5 text-sm">
            {cliente.nombre_contacto && (
              <div className="flex items-center gap-2 text-gray-600">
                <User className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{cliente.nombre_contacto}</span>
              </div>
            )}
            {cliente.telefono && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                <a href={`tel:${cliente.telefono}`} className="hover:text-blue-600">{cliente.telefono}</a>
              </div>
            )}
            {(cliente as { whatsapp?: string }).whatsapp && (
              <div className="flex items-center gap-2 text-gray-600">
                <MessageCircle className="h-4 w-4 text-green-500 shrink-0" />
                <a
                  href={`https://wa.me/57${(cliente as { whatsapp?: string }).whatsapp?.replace(/\D/g, '')}`}
                  target="_blank" rel="noreferrer"
                  className="hover:text-green-600"
                >
                  {(cliente as { whatsapp?: string }).whatsapp}
                </a>
              </div>
            )}
            {cliente.email && (
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                <a href={`mailto:${cliente.email}`} className="hover:text-blue-600 truncate">{cliente.email}</a>
              </div>
            )}
            {(cliente.ciudad || cliente.departamento) && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{[cliente.ciudad, cliente.departamento].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {cliente.direccion && (
              <div className="flex items-start gap-2 text-gray-600">
                <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                <span>{cliente.direccion}</span>
              </div>
            )}
            {cliente.regimen_tributario && (
              <div className="flex items-center gap-2 text-gray-600">
                <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="capitalize">{cliente.regimen_tributario.replace(/_/g, ' ')}</span>
              </div>
            )}
          </dl>
        </div>

        {/* Crédito */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-gray-400" /> Condiciones de crédito
          </h2>
          <CreditoSemaforo limite={cliente.limite_credito} dias={cliente.dias_credito} />
          {(cliente.limite_credito ?? 0) > 0 && (
            <dl className="space-y-3">
              {(() => {
                const limite   = cliente.limite_credito ?? 0
                const usado    = resumen?.saldo_pendiente ?? 0
                const disponible = Math.max(0, limite - usado)
                const pct      = limite > 0 ? Math.min(100, Math.round(usado / limite * 100)) : 0
                const barColor = pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-orange-400' : 'bg-green-400'
                return (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Límite de crédito</span>
                      <span className="font-semibold text-gray-900">{formatCOP(limite)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Días de crédito</span>
                      <span className="font-semibold text-gray-900">{cliente.dias_credito ?? 30} días</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Crédito usado</span>
                      <span className={`font-semibold ${usado > 0 ? 'text-orange-600' : 'text-gray-500 dark:text-gray-400 dark:text-gray-500'}`}>{formatCOP(usado)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Crédito disponible</span>
                      <span className="font-semibold text-green-600">{formatCOP(disponible)}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{pct}% usado</span>
                        <span>{formatCOP(limite)} límite</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100">
                        <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </>
                )
              })()}
            </dl>
          )}

          {/* Fechas */}
          <div className="pt-2 border-t border-gray-100 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Calendar className="h-3.5 w-3.5" />
              Registrado: {new Date(cliente.created_at ?? '').toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Observaciones */}
      {(cliente as { observaciones?: string }).observaciones && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
          <h2 className="mb-2 font-semibold text-gray-800">Observaciones</h2>
          <p className="text-sm text-gray-600 whitespace-pre-line">
            {(cliente as { observaciones?: string }).observaciones}
          </p>
        </div>
      )}

      {/* Últimas facturas */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-gray-400" /> Últimas facturas
          </p>
          <Link href={`/ventas/facturas?cliente_id=${cliente.id}`} className="text-xs text-blue-600 hover:underline">
            Ver todas →
          </Link>
        </div>
        {(resumen?.ultimas_facturas ?? []).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Sin facturas registradas</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 text-left font-medium">N°</th>
                <th className="pb-2 text-left font-medium">Fecha</th>
                <th className="pb-2 text-left font-medium">Estado</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(resumen?.ultimas_facturas ?? []).map(f => (
                <tr key={f.id}>
                  <td className="py-1.5">
                    <Link href={`/ventas/facturas/${f.id}`} className="font-mono text-blue-600 hover:underline text-xs">
                      {f.prefijo}{f.numero}
                    </Link>
                  </td>
                  <td className="py-1.5 text-gray-500 text-xs">{f.fecha}</td>
                  <td className="py-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      f.estado === 'pagada'    ? 'bg-green-100 text-green-700' :
                      f.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                      f.estado === 'parcial'   ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500 dark:text-gray-400 dark:text-gray-500'
                    }`}>{f.estado}</span>
                  </td>
                  <td className="py-1.5 text-right font-mono font-medium text-gray-800">{formatCOP(f.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal editar */}
      <Modal open={modal} onClose={() => setModal(false)} titulo="Editar cliente" size="lg">
        {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <FormCliente
          inicial={cliente}
          grupos={grupos}
          onGuardar={guardar}
          onCancelar={() => setModal(false)}
          cargando={saving}
        />
      </Modal>
    </div>
  )
}
