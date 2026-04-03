'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Search, X } from 'lucide-react'
import { Paginacion } from '@/components/ui/paginacion'

type Product = { product_code: string; nombre: string }

export function FiltrosPagos({ products }: { products: Product[] }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [, startTransition] = useTransition()

  function nav(updates: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    next.delete('offset')
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    startTransition(() => router.push(`/superadmin/planes?${next}`))
  }

  const hasFilters = sp.has('producto') || sp.has('tipo') || sp.has('desde') || sp.has('hasta') || sp.has('q')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={sp.get('producto') ?? ''}
        onChange={(e) => nav({ producto: e.target.value })}
        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      >
        <option value="">Todos los productos</option>
        {products.map((p) => (
          <option key={p.product_code} value={p.product_code}>{p.nombre}</option>
        ))}
      </select>

      <select
        value={sp.get('tipo') ?? ''}
        onChange={(e) => nav({ tipo: e.target.value })}
        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      >
        <option value="">Todos los tipos</option>
        <option value="payment">Pago</option>
        <option value="adjustment">Ajuste</option>
        <option value="extension">Extensión</option>
      </select>

      <input
        type="date"
        value={sp.get('desde') ?? ''}
        onChange={(e) => nav({ desde: e.target.value })}
        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        placeholder="Desde"
      />

      <input
        type="date"
        value={sp.get('hasta') ?? ''}
        onChange={(e) => nav({ hasta: e.target.value })}
        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        placeholder="Hasta"
      />

      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          defaultValue={sp.get('q') ?? ''}
          placeholder="Empresa o referencia…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') nav({ q: (e.target as HTMLInputElement).value })
          }}
          className="rounded-lg border border-gray-200 bg-white py-1.5 pl-7 pr-2.5 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        />
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => startTransition(() => router.push('/superadmin/planes'))}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <X className="h-3 w-3" />
          Limpiar
        </button>
      )}
    </div>
  )
}

export function PaginacionPagos({ total, limit, offset }: { total: number; limit: number; offset: number }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [, startTransition] = useTransition()

  return (
    <Paginacion
      total={total}
      limit={limit}
      offset={offset}
      onChange={(newOffset) => {
        const next = new URLSearchParams(sp.toString())
        if (newOffset > 0) next.set('offset', String(newOffset))
        else next.delete('offset')
        startTransition(() => router.push(`/superadmin/planes?${next}`))
      }}
    />
  )
}
