'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, AlertCircle, TrendingDown, FileWarning, X } from 'lucide-react'
import Link from 'next/link'

interface Notificacion {
  id: string
  tipo: string
  titulo: string
  mensaje?: string | null
  leida?: boolean
  datos?: Record<string, unknown> | null
  created_at: string
}

export function Notificaciones() {
  const [alertas, setAlertas] = useState<Notificacion[]>([])
  const [open, setOpen] = useState(false)
  const [cargando, setCargando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const cargar = async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/notificaciones?limit=20')
      const data = await res.json()
      setAlertas(data.items ?? [])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // Recargar cada 5 minutos
    const interval = setInterval(cargar, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const iconoPorTipo = (tipo: string) => {
    if (tipo === 'factura_vencida') return <FileWarning className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
    if (tipo === 'cotizacion_vencida') return <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
    return <TrendingDown className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="relative rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/80"
      >
        <Bell className="h-5 w-5" />
        {alertas.length > 0 && (
          <span className="absolute right-1 top-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900/95 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Notificaciones {alertas.length > 0 && <span className="ml-1 rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-xs dark:bg-red-900/30 dark:text-red-300">{alertas.length}</span>}
              </p>
              <div className="flex items-center gap-2">
                <Link href="/notificaciones" onClick={() => setOpen(false)} className="text-xs text-blue-600 hover:underline dark:text-blue-300">
                  Ver todas
                </Link>
                <button onClick={() => setOpen(false)}>
                  <X className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </button>
              </div>
            </div>

            {cargando ? (
              <div className="py-8 text-center text-sm text-gray-400">Cargando...</div>
            ) : alertas.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Todo en orden
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
                {alertas.map((a, i) => (
                  <Link
                    key={a.id ?? i}
                    href={(a.datos?.href as string) ?? '/notificaciones'}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
                  >
                    {iconoPorTipo(a.tipo)}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-tight">{a.titulo}</p>
                      {a.mensaje && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.mensaje}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(a.created_at).toLocaleString('es-CO')}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
