'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, Package, X, ArrowRight, FileText, Building2 } from 'lucide-react'

interface Resultado {
  tipo: 'cliente' | 'producto' | 'factura' | 'proveedor'
  id: string
  titulo: string
  detalle: string
  href: string
}

export function BusquedaGlobal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Resultado[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)

  // Abrir con CMD+K / Ctrl+K
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const buscar = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    const body = await fetch(`/api/busqueda?q=${encodeURIComponent(q)}`)
      .then((response) => response.json())
      .catch(() => ({ items: [] }))
    setResults(body.items ?? [])
    setSelected(0)
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => buscar(query), 300)
    return () => clearTimeout(t)
  }, [query, buscar])

  function navegar(href: string) {
    setOpen(false)
    setQuery('')
    setResults([])
    router.push(href)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') setSelected(s => Math.min(s + 1, results.length - 1))
    if (e.key === 'ArrowUp') setSelected(s => Math.max(s - 1, 0))
    if (e.key === 'Enter' && results[selected]) navegar(results[selected].href)
  }

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900/80 dark:text-gray-300 dark:hover:bg-gray-800/80 transition-colors"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Buscar...</span>
      <kbd className="hidden rounded bg-gray-200 px-1.5 py-0.5 text-xs font-mono text-gray-500 sm:inline dark:bg-gray-800 dark:text-gray-300">⌘K</kbd>
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm dark:bg-black/60" onClick={() => setOpen(false)} />

      {/* Panel */}
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900/95">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Buscar clientes, productos, facturas, proveedores..."
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none dark:text-gray-100"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-400 dark:border-gray-600 dark:text-gray-300">Esc</kbd>
        </div>

        {/* Resultados */}
        <div className="max-h-80 overflow-y-auto py-2">
          {loading && (
            <p className="px-4 py-3 text-sm text-gray-400">Buscando...</p>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">Sin resultados para &quot;{query}&quot;</p>
          )}
          {!loading && query.length < 2 && (
            <div className="flex flex-col gap-1 px-4 py-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Ir a</p>
              {[
                { label: 'Clientes', href: '/clientes', icon: Users },
                { label: 'Productos', href: '/productos', icon: Package },
                { label: 'Facturas', href: '/ventas/facturas', icon: FileText },
              ].map(item => (
                <button
                  key={item.href}
                  onClick={() => navegar(item.href)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/70"
                >
                  <item.icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  {item.label}
                  <ArrowRight className="ml-auto h-3 w-3 text-gray-300 dark:text-gray-600" />
                </button>
              ))}
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.tipo}-${r.id}`}
              onClick={() => navegar(r.href)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${i === selected ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/70'
                }`}
            >
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                r.tipo === 'cliente'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                  : r.tipo === 'producto'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400'
                    : r.tipo === 'factura'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                }`}>
                {r.tipo === 'cliente' && <Users className="h-3.5 w-3.5" />}
                {r.tipo === 'producto' && <Package className="h-3.5 w-3.5" />}
                {r.tipo === 'factura' && <FileText className="h-3.5 w-3.5" />}
                {r.tipo === 'proveedor' && <Building2 className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900 dark:text-gray-100">{r.titulo}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{r.detalle}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-2 text-xs text-gray-400 dark:border-gray-700">
            <span><kbd className="font-mono">↑↓</kbd> navegar</span>
            <span><kbd className="font-mono">↵</kbd> abrir</span>
            <span><kbd className="font-mono">Esc</kbd> cerrar</span>
          </div>
        )}
      </div>
    </div>
  )
}
