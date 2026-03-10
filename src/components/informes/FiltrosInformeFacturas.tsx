'use client'

import Link from 'next/link'
import { useState } from 'react'
import { RemoteLookup } from '@/components/ui/remote-lookup'

interface ClienteOption {
  id: string
  razon_social: string
  numero_documento?: string | null
  email?: string | null
}

interface Props {
  desde: string
  hasta: string
  estado?: string
  clienteId?: string
  clienteLabel?: string
}

function formatClienteLabel(cliente: ClienteOption) {
  if (!cliente.numero_documento) return cliente.razon_social
  return `${cliente.razon_social} (${cliente.numero_documento})`
}

export function FiltrosInformeFacturas({
  desde,
  hasta,
  estado,
  clienteId,
  clienteLabel,
}: Props) {
  const [selectedClienteId, setSelectedClienteId] = useState(clienteId ?? '')
  const [selectedClienteLabel, setSelectedClienteLabel] = useState(clienteLabel ?? '')

  return (
    <form className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <input type="hidden" name="cliente_id" value={selectedClienteId} />

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Desde</label>
        <input
          type="date"
          name="desde"
          defaultValue={desde}
          className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Hasta</label>
        <input
          type="date"
          name="hasta"
          defaultValue={hasta}
          className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Estado</label>
        <select
          name="estado"
          defaultValue={estado ?? ''}
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagada">Pagada</option>
          <option value="parcial">Parcial</option>
        </select>
      </div>

      <div className="flex min-w-72 flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Cliente</label>
        <RemoteLookup<ClienteOption>
          endpoint="/api/clientes"
          responseKey="clientes"
          value={selectedClienteId}
          initialLabel={selectedClienteLabel}
          placeholder="Buscar cliente por nombre, NIT o correo"
          emptyMessage="Sin clientes para mostrar"
          queryParams={{ activo: true }}
          minChars={1}
          onSelect={(cliente) => {
            setSelectedClienteId(cliente.id)
            setSelectedClienteLabel(formatClienteLabel(cliente))
          }}
          onClear={() => {
            setSelectedClienteId('')
            setSelectedClienteLabel('')
          }}
          getOptionLabel={(cliente) => formatClienteLabel(cliente)}
          getOptionDescription={(cliente) => cliente.email ?? undefined}
        />
      </div>

      <div className="flex items-end gap-2">
        <button type="submit" className="h-9 rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-700">
          Aplicar
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedClienteId('')
            setSelectedClienteLabel('')
          }}
          className="h-9 rounded-lg border border-gray-300 px-4 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
        >
          Limpiar cliente
        </button>
        <Link href="/informes/facturas" className="flex h-9 items-center rounded-lg border border-gray-300 px-4 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50">
          Limpiar todo
        </Link>
      </div>
    </form>
  )
}
