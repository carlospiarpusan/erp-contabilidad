'use client'

import { useId } from 'react'
import { RemoteLookup } from '@/components/ui/remote-lookup'
import {
  ClienteQuickCreateButton,
  formatClienteLookupLabel,
  type ClienteLookupOption,
} from '@/components/clientes/ClienteQuickCreateButton'

interface ClienteLookupFieldProps {
  value: string
  initialLabel?: string
  label?: string
  placeholder?: string
  className?: string
  lookupClassName?: string
  queryParams?: Record<string, string | number | boolean | undefined>
  onChange: (cliente: ClienteLookupOption | null) => void
}

export function ClienteLookupField({
  value,
  initialLabel,
  label = 'Cliente *',
  placeholder = 'Buscar por nombre, NIT o correo',
  className,
  lookupClassName,
  queryParams = { activo: true },
  onChange,
}: ClienteLookupFieldProps) {
  const inputId = useId()
  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>
        <ClienteQuickCreateButton
          onCreated={(cliente) => onChange(cliente)}
          triggerLabel="Nuevo cliente"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
        />
      </div>

      <RemoteLookup<ClienteLookupOption>
        endpoint="/api/clientes"
        responseKey="clientes"
        id={inputId}
        value={value}
        initialLabel={initialLabel}
        placeholder={placeholder}
        emptyMessage="Sin clientes para mostrar"
        queryParams={queryParams}
        minChars={1}
        className={lookupClassName}
        onSelect={(cliente) => onChange(cliente)}
        onClear={() => onChange(null)}
        getOptionLabel={(cliente) => formatClienteLookupLabel(cliente)}
        getOptionDescription={(cliente) => cliente.email ?? undefined}
      />
    </div>
  )
}
