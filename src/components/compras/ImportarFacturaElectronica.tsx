'use client'

import { useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  FileArchive,
  Link as LinkIcon,
  Loader2,
  Package,
  Plus,
  RefreshCcw,
  Upload,
} from 'lucide-react'
import Link from 'next/link'
import { cn, cardCls } from '@/utils/cn'
import { buildSuggestedFacturaProductCode } from '@/lib/import/factura-electronica-shared'

interface Cabecera {
  numero_externo: string
  fecha: string
  fecha_original: string
  nit_proveedor: string
  nombre_proveedor: string
  total: number
  subtotal: number
  iva: number
}

interface Proveedor {
  id: string
  numero_documento: string | null
  razon_social: string
}

interface ProductoDisponible {
  id: string
  codigo: string
  codigo_barras?: string | null
  descripcion: string
}

interface Bodega {
  id: string
  nombre: string
}

interface EjercicioActivo {
  id: string
  año: number
  fecha_inicio: string
  fecha_fin: string
}

interface Sugerencia {
  producto_id: string
  codigo: string
  descripcion: string
  score: number
  reason: string
}

interface LineaImportada {
  descripcion: string
  codigo_pdf: string
  gtin: string | null
  standard_scheme_id: string | null
  standard_scheme_name: string | null
  cantidad: number
  precio_unitario: number
  precio_referencia: number | null
  subtotal: number
  subtotal_neto: number
  total_descuento: number
  descuento_porcentaje: number
  iva: number
  total: number
  porcentaje_iva: number
  producto_id: string | null
  producto_codigo: string | null
  producto_descripcion: string | null
  estado: 'encontrado' | 'no_encontrado' | 'sin_codigo'
  match_source: string
  sugerencias: Sugerencia[]
  grupo_clave: string
}

type AccionLinea = 'usar_existente' | 'crear_nuevo'

interface MapeoLinea {
  accion: AccionLinea
  producto_id: string
  nuevo_codigo: string
  nueva_descripcion: string
  nuevo_precio_venta: string
  persistir_gtin: boolean
}

type Paso = 'subir' | 'revisar' | 'confirmando' | 'resultado'

interface ParseFacturaResponse {
  cabecera: Cabecera
  fecha_original: string
  fecha_contabilizacion_sugerida: string
  ejercicio_activo: EjercicioActivo | null
  proveedor: Proveedor | null
  proveedores_disponibles: Proveedor[]
  lineas: LineaImportada[]
  productos_disponibles: ProductoDisponible[]
  bodegas: Bodega[]
}

interface ConfirmarFacturaResponse {
  id: string
  created_products?: ProductoCreadoResumen[]
}

interface ProductoCreadoResumen {
  id: string
  codigo: string
  descripcion: string
  codigo_barras: string | null
  cantidad_importada: number
  lineas_importadas: number
  precio_compra: number
  precio_venta: number
  porcentaje_iva: number
  total_descuento: number
}

function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatScore(score: number) {
  return `${Math.round(score * 100)}%`
}

function formatCantidad(value: number) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value)
}

function sourceLabel(matchSource: string) {
  switch (matchSource) {
    case 'codigo_interno':
      return 'match exacto por codigo'
    default:
      return 'sin match exacto por codigo'
  }
}

async function readApiResponse<T>(res: Response) {
  const raw = await res.text()
  const contentType = res.headers.get('content-type') ?? ''

  if (!raw.trim()) {
    return {
      data: null as T | null,
      message: `Error ${res.status}`,
    }
  }

  if (contentType.includes('application/json')) {
    try {
      const data = JSON.parse(raw) as T & { error?: string }
      return {
        data,
        message: typeof data.error === 'string' ? data.error : `Error ${res.status}`,
      }
    } catch {
      return {
        data: null as T | null,
        message: `La respuesta del servidor no es JSON valido (HTTP ${res.status})`,
      }
    }
  }

  const normalized = raw
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    data: null as T | null,
    message: normalized || `Error ${res.status}`,
  }
}

export function ImportarFacturaElectronica() {
  const [paso, setPaso] = useState<Paso>('subir')
  const [cargando, setCargando] = useState(false)
  const [dragActiva, setDragActiva] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [cabecera, setCabecera] = useState<Cabecera | null>(null)
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [proveedoresDisponibles, setProveedoresDisponibles] = useState<Proveedor[]>([])
  const [lineas, setLineas] = useState<LineaImportada[]>([])
  const [productosDisp, setProductosDisp] = useState<ProductoDisponible[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [ejercicioActivo, setEjercicioActivo] = useState<EjercicioActivo | null>(null)
  const [mapeos, setMapeos] = useState<MapeoLinea[]>([])
  const [bodegaId, setBodegaId] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [fechaContabilizacion, setFechaContabilizacion] = useState('')
  const [resultadoId, setResultadoId] = useState<string | null>(null)
  const [productosCreados, setProductosCreados] = useState<ProductoCreadoResumen[]>([])

  const fileRef = useRef<HTMLInputElement>(null)

  function buildInitialMapeos(lineasImportadas: LineaImportada[], productosDisponibles: ProductoDisponible[]) {
    const usedCodes = new Set(
      productosDisponibles
        .map((producto) => producto.codigo.trim().toUpperCase())
        .filter(Boolean)
    )
    const codeByGroup = new Map<string, string>()

    const getUniqueCode = (baseCode: string) => {
      const base = baseCode.trim().toUpperCase() || 'AUTO-PRODUCTO'
      if (!usedCodes.has(base)) {
        usedCodes.add(base)
        return base
      }

      let suffix = 2
      while (true) {
        const candidate = `${base.slice(0, Math.max(1, 44 - String(suffix).length))}-${suffix}`
        if (!usedCodes.has(candidate)) {
          usedCodes.add(candidate)
          return candidate
        }
        suffix += 1
      }
    }

    return lineasImportadas.map((linea) => {
      if (linea.producto_id) {
        return {
          accion: 'usar_existente' as const,
          producto_id: linea.producto_id,
          nuevo_codigo: linea.codigo_pdf || '',
          nueva_descripcion: linea.descripcion,
          nuevo_precio_venta: String(Math.round(linea.precio_unitario || 0)),
          persistir_gtin: Boolean(linea.gtin),
        }
      }

      const existingCode = codeByGroup.get(linea.grupo_clave)
      const suggestedCode = existingCode ?? getUniqueCode(buildSuggestedFacturaProductCode({
        codigoPdf: linea.codigo_pdf,
        gtin: linea.gtin,
        descripcion: linea.descripcion,
        groupKey: linea.grupo_clave,
      }))
      codeByGroup.set(linea.grupo_clave, suggestedCode)

      return {
        accion: 'crear_nuevo' as const,
        producto_id: '',
        nuevo_codigo: suggestedCode,
        nueva_descripcion: linea.descripcion,
        nuevo_precio_venta: String(Math.round(linea.precio_unitario || 0)),
        persistir_gtin: Boolean(linea.gtin),
      }
    })
  }

  async function procesarArchivo(file: File) {
    setCargando(true)
    setError(null)

    try {
      const fileName = file.name.toLowerCase()
      const isSupported = fileName.endsWith('.zip') || fileName.endsWith('.pdf')
      if (!isSupported) {
        throw new Error('Formato no soportado. Sube un archivo ZIP o PDF.')
      }

      const fd = new FormData()
      fd.append('archivo', file)

      const res = await fetch('/api/import/factura-electronica/parse', { method: 'POST', body: fd })
      const { data, message } = await readApiResponse<ParseFacturaResponse>(res)
      if (!res.ok || !data) {
        throw new Error(message)
      }

      setCabecera(data.cabecera)
      setProveedor(data.proveedor)
      setProveedoresDisponibles(data.proveedores_disponibles ?? [])
      setLineas(data.lineas ?? [])
      setProductosDisp(data.productos_disponibles ?? [])
      setBodegas(data.bodegas ?? [])
      setEjercicioActivo(data.ejercicio_activo ?? null)
      setBodegaId(data.bodegas?.[0]?.id ?? '')
      setProveedorId(data.proveedor?.id ?? '')
      setFechaContabilizacion(data.fecha_contabilizacion_sugerida ?? data.cabecera?.fecha_original ?? '')
      setMapeos(buildInitialMapeos(data.lineas ?? [], data.productos_disponibles ?? []))
      setPaso('revisar')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setCargando(false)
    }
  }

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await procesarArchivo(file)
  }

  function setMapeo(index: number, campo: keyof MapeoLinea, valor: string | boolean) {
    setMapeos((prev) => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [campo]: valor } : item
    )))
  }

  function applySuggestion(index: number, suggestion: Sugerencia) {
    setMapeos((prev) => prev.map((item, itemIndex) => (
      itemIndex === index
        ? {
          ...item,
          accion: 'usar_existente',
          producto_id: suggestion.producto_id,
        }
        : item
    )))
  }

  function applyToGroup(index: number) {
    const reference = lineas[index]?.grupo_clave
    const source = mapeos[index]
    if (!reference || !source) return

    setMapeos((prev) => prev.map((item, itemIndex) => (
      lineas[itemIndex]?.grupo_clave === reference
        ? { ...source }
        : item
    )))
  }

  function lineaResuelta(linea: LineaImportada, mapeo: MapeoLinea | undefined) {
    if (!linea || !mapeo) return false
    if (mapeo.accion === 'usar_existente') return Boolean(mapeo.producto_id)
    return Boolean(mapeo.nuevo_codigo.trim())
  }

  async function confirmar() {
    if (!proveedorId) {
      setError('Selecciona el proveedor')
      return
    }
    if (!bodegaId) {
      setError('Selecciona la bodega')
      return
    }
    if (!fechaContabilizacion) {
      setError('Selecciona la fecha contable')
      return
    }

    const pendientes = lineas.filter((linea, index) => !lineaResuelta(linea, mapeos[index]))
    if (pendientes.length > 0) {
      setError(`Hay ${pendientes.length} lineas sin resolver`)
      return
    }

    setPaso('confirmando')
    setCargando(true)
    setError(null)

    try {
      const lineasPayload = lineas.map((linea, index) => {
        const mapeo = mapeos[index]
        return {
          descripcion: linea.descripcion,
          codigo_pdf: linea.codigo_pdf,
          gtin: linea.gtin,
          standard_scheme_id: linea.standard_scheme_id,
          standard_scheme_name: linea.standard_scheme_name,
          cantidad: linea.cantidad,
          precio_unitario: linea.precio_unitario,
          subtotal: linea.subtotal,
          subtotal_neto: linea.subtotal_neto,
          total_descuento: linea.total_descuento,
          descuento_porcentaje: linea.descuento_porcentaje,
          iva: linea.iva,
          total: linea.total,
          porcentaje_iva: linea.porcentaje_iva,
          accion: mapeo.accion,
          producto_id: mapeo.accion === 'usar_existente' ? mapeo.producto_id || null : null,
          nuevo_codigo: mapeo.accion === 'crear_nuevo' ? mapeo.nuevo_codigo.trim().toUpperCase() : undefined,
          nueva_descripcion: mapeo.accion === 'crear_nuevo' ? mapeo.nueva_descripcion.trim() : undefined,
          nuevo_precio_venta: mapeo.accion === 'crear_nuevo' ? Number(mapeo.nuevo_precio_venta) || undefined : undefined,
          persistir_gtin: Boolean(mapeo.persistir_gtin && linea.gtin),
        }
      })

      const res = await fetch('/api/import/factura-electronica/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor_id: proveedorId,
          bodega_id: bodegaId,
          fecha_contabilizacion: fechaContabilizacion,
          fecha_original: cabecera?.fecha_original,
          numero_externo: cabecera?.numero_externo,
          lineas: lineasPayload,
        }),
      })
      const { data, message } = await readApiResponse<ConfirmarFacturaResponse>(res)
      if (!res.ok || !data) {
        throw new Error(message)
      }

      setResultadoId(data.id)
      setProductosCreados(data.created_products ?? [])
      setPaso('resultado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      setPaso('revisar')
    } finally {
      setCargando(false)
    }
  }

  const groupCounts = lineas.reduce<Record<string, number>>((acc, linea) => {
    acc[linea.grupo_clave] = (acc[linea.grupo_clave] ?? 0) + 1
    return acc
  }, {})
  const pendientes = lineas.filter((linea, index) => !lineaResuelta(linea, mapeos[index])).length
  const fechaFueraDeRango = Boolean(
    ejercicioActivo &&
    fechaContabilizacion &&
    (fechaContabilizacion < ejercicioActivo.fecha_inicio || fechaContabilizacion > ejercicioActivo.fecha_fin)
  )

  if (paso === 'subir') {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-300">
          <p className="mb-1 font-medium">Que hace esta importacion</p>
          <ul className="list-inside list-disc space-y-1 text-xs">
            <li>Acepta el PDF de la factura o el ZIP original cuando incluya PDF legible</li>
            <li>El match automatico usa solo la columna Codigo del PDF contra el codigo interno del articulo</li>
            <li>Si el PDF no trae codigo legible o no cuadra con el XML, la importacion se bloquea</li>
            <li>Extrae cantidades, descuentos, IVA, totales y te deja resolver manualmente las lineas sin match</li>
            <li>Al confirmar, crea la factura de compra, registra el asiento, actualiza stock, costo de compra e IVA del producto</li>
          </ul>
        </div>

        <div
          className={cn(
            'cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors dark:border-gray-700',
            dragActiva
              ? 'border-blue-500 bg-blue-50/50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
          )}
          onClick={() => fileRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault()
            setDragActiva(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragActiva(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setDragActiva(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setDragActiva(false)
            const file = e.dataTransfer.files?.[0]
            if (!file || cargando) return
            void procesarArchivo(file)
          }}
        >
          {cargando ? (
            <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-blue-500" />
          ) : (
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <FileArchive className="h-5 w-5" />
          </div>
          )}
          <p className="mb-1 text-base font-medium text-gray-700 dark:text-gray-300">
            {cargando ? 'Procesando archivo...' : 'Arrastra un ZIP o PDF aqui'}
          </p>
          <p className="mb-4 text-sm text-gray-500">o haz clic para seleccionar</p>
          <p className="mb-4 text-xs text-gray-400">Recomendado: subir el ZIP original con XML + PDF para validar el codigo de cada articulo</p>
          <span className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Upload className="h-4 w-4" />
            Seleccionar ZIP o PDF
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,.pdf,application/zip,application/x-zip-compressed,application/pdf"
            className="hidden"
            onChange={onArchivo}
            disabled={cargando}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>
    )
  }

  if (paso === 'resultado') {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle className="h-8 w-8 text-emerald-600" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Factura importada correctamente</h3>
          <p className="mt-1 text-sm text-gray-500">
            La factura <strong>{cabecera?.numero_externo}</strong> fue registrada con fecha contable{' '}
            <strong>{fechaContabilizacion}</strong>.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            El inventario, el precio de compra y la configuracion de IVA de los productos quedaron sincronizados con esta compra.
          </p>
        </div>
        {productosCreados.length > 0 && (
          <div className="w-full max-w-4xl rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left">
            <p className="mb-3 text-sm font-semibold text-emerald-800">
              Se crearon {productosCreados.length} producto{productosCreados.length === 1 ? '' : 's'} nuevo{productosCreados.length === 1 ? '' : 's'}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {productosCreados.map((producto) => (
                <div key={producto.id} className="rounded-lg border border-emerald-200 bg-white p-3 text-sm text-gray-700">
                  <p className="font-semibold text-gray-900">{producto.codigo}</p>
                  <p className="text-xs text-gray-600">{producto.descripcion}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    Stock agregado: <strong>{formatCantidad(producto.cantidad_importada)}</strong>
                    {` • `}
                    Precio compra: <strong>{formatCOP(producto.precio_compra)}</strong>
                    {` • `}
                    IVA: <strong>{producto.porcentaje_iva}%</strong>
                  </p>
                  {producto.total_descuento > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Descuento importado: <strong>{formatCOP(producto.total_descuento)}</strong>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-3">
          {resultadoId && (
            <Link
              href={`/compras/facturas/${resultadoId}`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Ver factura <ChevronRight className="h-4 w-4" />
            </Link>
          )}
          <button
            onClick={() => {
              setPaso('subir')
              setError(null)
              setCabecera(null)
              setLineas([])
              setMapeos([])
              setProductosCreados([])
              if (fileRef.current) fileRef.current.value = ''
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Importar otra factura
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {cabecera && (
        <div className={cn(cardCls, 'p-5')}>
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Datos de la factura</h3>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Factura proveedor</p>
              <p className="font-mono font-semibold">{cabecera.numero_externo || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Fecha DIAN original</p>
              <p className="font-semibold">{cabecera.fecha_original}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Proveedor</p>
              <p className="font-semibold">{cabecera.nombre_proveedor || cabecera.nit_proveedor || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="font-mono font-bold text-blue-700">{formatCOP(cabecera.total)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Proveedor en el sistema <span className="text-red-500">*</span>
          </label>
          {proveedor ? (
            <div className="flex h-9 items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm">
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span className="font-medium text-emerald-800">{proveedor.razon_social}</span>
            </div>
          ) : (
            <>
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Seleccionar proveedor —</option>
                {proveedoresDisponibles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.razon_social}
                    {item.numero_documento ? ` — ${item.numero_documento}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400">
                Si no aparece, <Link href="/compras/proveedores/nuevo" className="text-blue-600 hover:underline">crealo primero</Link> y vuelve a importar.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Bodega de entrada <span className="text-red-500">*</span>
          </label>
          <select
            value={bodegaId}
            onChange={(e) => setBodegaId(e.target.value)}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Seleccionar bodega —</option>
            {bodegas.map((bodega) => (
              <option key={bodega.id} value={bodega.id}>{bodega.nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Fecha contable efectiva <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={fechaContabilizacion}
            min={ejercicioActivo?.fecha_inicio}
            max={ejercicioActivo?.fecha_fin}
            onChange={(e) => setFechaContabilizacion(e.target.value)}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {ejercicioActivo && (
            <p className={`text-xs ${fechaFueraDeRango ? 'text-red-500' : 'text-gray-400'}`}>
              Ejercicio activo {ejercicioActivo.año}: {ejercicioActivo.fecha_inicio} a {ejercicioActivo.fecha_fin}
            </p>
          )}
        </div>
      </div>

      <div className={cn(cardCls, 'overflow-hidden')}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Lineas de la factura ({lineas.length})
          </h3>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {pendientes} pendientes
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {lineas.filter((linea) => linea.match_source !== 'sin_match').length} con match exacto
            </span>
          </div>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {lineas.map((linea, index) => {
            const mapeo = mapeos[index]
            const groupSize = groupCounts[linea.grupo_clave] ?? 1
            const resuelta = lineaResuelta(linea, mapeo)

            return (
              <div key={`${linea.grupo_clave}-${index}`} className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {linea.codigo_pdf && (
                        <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          Codigo PDF: {linea.codigo_pdf}
                        </span>
                      )}
                      {linea.gtin && (
                        <span className="rounded bg-sky-50 px-2 py-0.5 font-mono text-xs text-sky-700">
                          GTIN: {linea.gtin}
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{linea.descripcion}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {linea.cantidad} x {formatCOP(linea.precio_unitario)} = {formatCOP(linea.subtotal)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {linea.total_descuento > 0
                        ? `Descuento ${linea.descuento_porcentaje}% (${formatCOP(linea.total_descuento)}) • Neto ${formatCOP(linea.subtotal_neto)}`
                        : `Neto ${formatCOP(linea.subtotal_neto)}`}
                      {linea.porcentaje_iva > 0 ? ` • IVA ${linea.porcentaje_iva}% (${formatCOP(linea.iva)})` : ''}
                      {` • Total ${formatCOP(linea.total)}`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 font-medium',
                        linea.match_source === 'sin_match'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      )}>
                        {sourceLabel(linea.match_source)}
                      </span>
                      {!linea.producto_id && mapeo?.accion === 'crear_nuevo' && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                          Se creara automaticamente
                        </span>
                      )}
                      {groupSize > 1 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                          {groupSize} lineas con la misma referencia
                        </span>
                      )}
                    </div>
                  </div>

                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                    resuelta ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  )}>
                    {resuelta ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                    {resuelta ? 'Resuelta' : 'Requiere decision'}
                  </span>
                </div>

                {linea.producto_id && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>
                      Coincidencia exacta: <strong>{linea.producto_codigo}</strong> — {linea.producto_descripcion}
                    </span>
                  </div>
                )}

                {!linea.producto_id && linea.sugerencias.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <Package className="h-3.5 w-3.5" />
                      Sugerencias ({linea.sugerencias.length})
                    </div>
                    <div className="grid gap-2 lg:grid-cols-2">
                      {linea.sugerencias.map((suggestion) => (
                        <button
                          key={`${index}-${suggestion.producto_id}`}
                          type="button"
                          onClick={() => applySuggestion(index, suggestion)}
                          className="flex items-start justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-blue-400"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">{suggestion.codigo}</p>
                            <p className="text-xs text-gray-600">{suggestion.descripcion}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">{suggestion.reason}</p>
                          </div>
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {formatScore(suggestion.score)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMapeo(index, 'accion', 'usar_existente')}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      mapeo?.accion === 'usar_existente'
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-blue-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                    )}
                  >
                    <LinkIcon className="h-3.5 w-3.5" /> Mapear a existente
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapeo(index, 'accion', 'crear_nuevo')}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      mapeo?.accion === 'crear_nuevo'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-emerald-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" /> Crear producto nuevo
                  </button>
                  {groupSize > 1 && (
                    <button
                      type="button"
                      onClick={() => applyToGroup(index)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-500"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" /> Aplicar a {groupSize} lineas
                    </button>
                  )}
                </div>

                {mapeo?.accion === 'usar_existente' && (
                  <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">Producto del sistema</label>
                      <select
                        value={mapeo.producto_id}
                        onChange={(e) => setMapeo(index, 'producto_id', e.target.value)}
                        className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Seleccionar producto —</option>
                        {productosDisp.map((producto) => (
                          <option key={producto.id} value={producto.id}>
                            {producto.codigo} — {producto.descripcion}
                            {producto.codigo_barras ? ` — ${producto.codigo_barras}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <label className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={mapeo.persistir_gtin}
                          disabled={!linea.gtin}
                          onChange={(e) => setMapeo(index, 'persistir_gtin', e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-blue-600"
                        />
                        <span>
                          Guardar GTIN en codigo de barras
                          {!linea.gtin && <span className="block text-xs text-slate-500">Esta linea no trae GTIN real</span>}
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {mapeo?.accion === 'crear_nuevo' && (
                  <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">Codigo interno nuevo</label>
                      <input
                        value={mapeo.nuevo_codigo}
                        onChange={(e) => setMapeo(index, 'nuevo_codigo', e.target.value.toUpperCase())}
                        className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="CODIGO-INTERNO"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">Descripcion</label>
                      <input
                        value={mapeo.nueva_descripcion}
                        onChange={(e) => setMapeo(index, 'nueva_descripcion', e.target.value)}
                        className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">Precio de venta</label>
                      <input
                        type="number"
                        value={mapeo.nuevo_precio_venta}
                        onChange={(e) => setMapeo(index, 'nuevo_precio_venta', e.target.value)}
                        className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <label className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 md:col-span-1">
                      <input
                        type="checkbox"
                        checked={mapeo.persistir_gtin}
                        disabled={!linea.gtin}
                        onChange={(e) => setMapeo(index, 'persistir_gtin', e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-emerald-600"
                      />
                      <span>
                        Guardar GTIN en codigo de barras
                        {!linea.gtin && <span className="block text-xs text-slate-500">No aplica para esta linea</span>}
                      </span>
                    </label>

                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">
        Al confirmar se registrara una <strong>factura de compra</strong>, se actualizara el stock de la bodega, el ultimo precio de compra y el impuesto del producto cuando la linea traiga IVA homologable.
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            setPaso('subir')
            setError(null)
            if (fileRef.current) fileRef.current.value = ''
          }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Cargar otro archivo
        </button>

        <button
          onClick={confirmar}
          disabled={cargando || !proveedorId || !bodegaId || !fechaContabilizacion || pendientes > 0 || fechaFueraDeRango}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {cargando
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</>
            : <>Confirmar importacion <ChevronRight className="h-4 w-4" /></>
          }
        </button>
      </div>
    </div>
  )
}
