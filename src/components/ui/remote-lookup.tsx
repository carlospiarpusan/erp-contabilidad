'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

type LookupItem = {
  id: string
}

type RemoteLookupProps<T extends LookupItem> = {
  endpoint: string
  responseKey: string
  value: string
  initialLabel?: string
  placeholder: string
  emptyMessage: string
  onSelect: (item: T) => void
  onClear?: () => void
  onInputValueChange?: (value: string) => void
  getOptionLabel: (item: T) => string
  getOptionDescription?: (item: T) => string | undefined
  renderOptionDescription?: (item: T) => ReactNode
  queryParams?: Record<string, string | number | boolean | undefined>
  limit?: number
  minChars?: number
  disabled?: boolean
  className?: string
  inputClassName?: string
  panelClassName?: string
  resultsClassName?: string
  optionClassName?: string
  /** id del campo de texto, para enlazarlo con un <label htmlFor>. */
  id?: string
  /** Nombre accesible cuando no hay <label> visible; por defecto, el placeholder. */
  ariaLabel?: string
}

export function RemoteLookup<T extends LookupItem>({
  endpoint,
  responseKey,
  value,
  initialLabel,
  placeholder,
  emptyMessage,
  onSelect,
  onClear,
  onInputValueChange,
  getOptionLabel,
  getOptionDescription,
  renderOptionDescription,
  queryParams,
  limit = 12,
  minChars = 0,
  disabled,
  className,
  inputClassName,
  panelClassName,
  resultsClassName,
  optionClassName,
  id,
  ariaLabel,
}: RemoteLookupProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState(initialLabel ?? '')
  const [items, setItems] = useState<T[]>([])
  const onInputValueChangeRef = useRef(onInputValueChange)

  const queryParamsKey = JSON.stringify(queryParams ?? {})

  useEffect(() => {
    onInputValueChangeRef.current = onInputValueChange
  }, [onInputValueChange])

  useEffect(() => {
    if (!value) {
      setQuery('')
      onInputValueChangeRef.current?.('')
      return
    }

    if (initialLabel) {
      setQuery(initialLabel)
      onInputValueChangeRef.current?.(initialLabel)
    }
  }, [initialLabel, value])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (!open || disabled) return

    const resolvedQueryParams = JSON.parse(queryParamsKey) as Record<string, string | number | boolean | undefined>
    const trimmed = query.trim()
    if (trimmed.length > 0 && trimmed.length < minChars) {
      setItems([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true)

        const params = new URLSearchParams()
        params.set('limit', String(limit))
        params.set('select_mode', 'selector')
        params.set('include_total', 'false')

        for (const [key, rawValue] of Object.entries(resolvedQueryParams)) {
          if (rawValue === undefined) continue
          params.set(key, String(rawValue))
        }

        if (trimmed) {
          params.set('q', trimmed)
        }

        const res = await fetch(`${endpoint}?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        })

        if (!res.ok) throw new Error('No fue posible cargar opciones')

        const data = await res.json()
        const nextItems = Array.isArray(data?.[responseKey]) ? data[responseKey] as T[] : []
        setItems(nextItems)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setItems([])
        }
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [disabled, endpoint, limit, minChars, open, query, queryParamsKey, responseKey])

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <input
        id={id}
        type="text"
        value={query}
        placeholder={placeholder}
        aria-label={id ? undefined : (ariaLabel ?? placeholder)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation()
            setOpen(false)
          }
        }}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          const nextValue = event.target.value
          setQuery(nextValue)
          onInputValueChangeRef.current?.(nextValue)
          if (!nextValue.trim()) {
            onClear?.()
          }
          setOpen(true)
        }}
        className={`h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-teal-400 ${inputClassName ?? ''}`}
      />

      {open && (
        <div className={`absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg shadow-slate-200/60 dark:border-gray-700 dark:bg-gray-950/98 dark:shadow-black/40 ${panelClassName ?? ''}`}>
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Buscando...</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              {query.trim().length > 0 && query.trim().length < minChars
                ? `Escribe al menos ${minChars} caracteres`
                : emptyMessage}
            </div>
          ) : (
            <div className={`max-h-64 overflow-y-auto ${resultsClassName ?? ''}`}>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const label = getOptionLabel(item)
                    onSelect(item)
                    setQuery(label)
                    onInputValueChangeRef.current?.(label)
                    setOpen(false)
                  }}
                  className={`flex w-full flex-col px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 ${item.id === value ? 'bg-blue-50 dark:bg-teal-500/12' : ''} ${optionClassName ?? ''}`}
                >
                  <span className="font-medium text-gray-800 dark:text-gray-100">{getOptionLabel(item)}</span>
                  {renderOptionDescription ? (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{renderOptionDescription(item)}</span>
                  ) : getOptionDescription ? (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{getOptionDescription(item)}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
