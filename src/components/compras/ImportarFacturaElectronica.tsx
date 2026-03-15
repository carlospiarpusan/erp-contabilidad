'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, ChevronRight, Plus, Link as LinkIcon, Package, Loader2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { cn, cardCls } from '@/utils/cn'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Cabecera {
  numero_externo: string
  fecha: string
  nit_proveedor: string
  nombre_proveedor: string
  total: number
  subtotal: number
  iva: number
}

interface Proveedor {
  id: string
  numero_documento: string
  razon_social: string
}

interface ProductoDisponible {
  id: string
  codigo: string
  descripcion: string
}

interface Bodega {
  id: string
  nombre: string
}

interface LineaXML {
  descripcion: string
  codigo: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  iva: number
  total: number
  producto_id: string | null
  producto_codigo: string | null
  producto_descripcion: string | null
  estado: 'encontrado' | 'no_encontrado' | 'sin_codigo'
}

type AccionLinea = 'usar_existente' | 'crear_nuevo' | 'sin_producto'

interface MapeoLinea {
  accion: AccionLinea
  producto_id: string
  nuevo_codigo: string
  nueva_descripcion: string
  nuevo_precio_venta: string
}

type Paso = 'subir' | 'revisar' | 'confirmando' | 'resultado'

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ImportarFacturaElectronica() {
  const [paso, setPaso]           = useState<Paso>('subir')
  const [cargando, setCargando]   = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Datos del parse
  const [cabecera, setCabecera]   = useState<Cabecera | null>(null)
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [lineas, setLineas]       = useState<LineaXML[]>([])
  const [productosDisp, setProductosDisp] = useState<ProductoDisponible[]>([])
  const [bodegas, setBodegas]     = useState<Bodega[]>([])

  // Mapeos del usuario por línea
  const [mapeos, setMapeos]       = useState<MapeoLinea[]>([])
  const [bodegaId, setBodegaId]   = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [resultadoId, setResultadoId] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  // ── Paso 1: subir XML ──────────────────────────────────────────────────────
  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCargando(true)
    setError(null)

    try {
      const fd = new FormData()
      fd.append('archivo', file)

      const res = await fetch('/api/import/factura-electronica/parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setCabecera(data.cabecera)
      setProveedor(data.proveedor)
      setLineas(data.lineas)
      setProductosDisp(data.productos_disponibles)
      setBodegas(data.bodegas)
      setBodegaId(data.bodegas?.[0]?.id ?? '')
      setProveedorId(data.proveedor?.id ?? '')

      // Inicializar mapeos según estado de cada línea
      setMapeos(data.lineas.map((l: LineaXML) => ({
        accion:            l.estado === 'encontrado' ? 'usar_existente' : 'sin_producto',
        producto_id:       l.producto_id ?? '',
        nuevo_codigo:      l.codigo || '',
        nueva_descripcion: l.descripcion,
        nuevo_precio_venta: String(l.precio_unitario ?? ''),
      })))

      setPaso('revisar')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCargando(false)
    }
  }

  function setMapeo(i: number, campo: keyof MapeoLinea, valor: string) {
    setMapeos(prev => prev.map((m, idx) => idx === i ? { ...m, [campo]: valor } : m))
  }

  // ── Paso 3: confirmar importación ─────────────────────────────────────────
  async function confirmar() {
    if (!proveedorId) { setError('Selecciona el proveedor'); return }
    if (!bodegaId)    { setError('Selecciona la bodega'); return }
    setPaso('confirmando')
    setCargando(true)
    setError(null)

    try {
      const lineas_payload = lineas.map((l, i) => {
        const m = mapeos[i]
        return {
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          subtotal: l.subtotal,
          iva: l.iva,
          total: l.total,
          accion: m.accion,
          producto_id: m.accion === 'usar_existente' ? m.producto_id || null : null,
          nuevo_codigo: m.accion === 'crear_nuevo' ? m.nuevo_codigo : undefined,
          nueva_descripcion: m.accion === 'crear_nuevo' ? m.nueva_descripcion : undefined,
          nuevo_precio_venta: m.accion === 'crear_nuevo' ? Number(m.nuevo_precio_venta) || undefined : undefined,
        }
      })

      const res = await fetch('/api/import/factura-electronica/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor_id: proveedorId,
          bodega_id: bodegaId,
          fecha: cabecera?.fecha,
          numero_externo: cabecera?.numero_externo,
          lineas: lineas_payload,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setResultadoId(data.id)
      setPaso('resultado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      setPaso('revisar')
    } finally {
      setCargando(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (paso === 'subir') {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-blue-100 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-900/30 p-4 text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium mb-1">¿Qué hace esta importación?</p>
          <ul className="space-y-1 text-xs list-disc list-inside">
            <li>Lee el XML de factura electrónica enviado por tu proveedor (formato DIAN UBL 2.1)</li>
            <li>Detecta cada producto en la factura y lo busca en tu inventario por código</li>
            <li>Si no lo encuentra, te pregunta si quieres mapearlo a un producto existente o crear uno nuevo</li>
            <li>Al confirmar: crea la factura de compra, actualiza el stock y genera el asiento contable</li>
          </ul>
        </div>

        <div
          className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {cargando ? (
            <Loader2 className="h-10 w-10 text-blue-500 mx-auto mb-3 animate-spin" />
          ) : (
            <FileText className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          )}
          <p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">
            {cargando ? 'Procesando XML…' : 'Arrastra el archivo XML aquí'}
          </p>
          <p className="text-sm text-gray-500 mb-4">o haz clic para seleccionar</p>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
            <Upload className="h-4 w-4" />
            Seleccionar XML
          </span>
          <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={onArchivo} disabled={cargando} />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
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
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">¡Factura importada exitosamente!</h3>
          <p className="text-sm text-gray-500 mt-1">
            La factura <strong>{cabecera?.numero_externo}</strong> fue registrada, el stock fue actualizado y el asiento contable fue generado.
          </p>
        </div>
        <div className="flex gap-3">
          {resultadoId && (
            <Link href={`/compras/facturas/${resultadoId}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
              Ver factura <ChevronRight className="h-4 w-4" />
            </Link>
          )}
          <button
            onClick={() => { setPaso('subir'); setError(null); setCabecera(null); setLineas([]); if (fileRef.current) fileRef.current.value = '' }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Importar otra factura
          </button>
        </div>
      </div>
    )
  }

  // ── Paso revisar ──────────────────────────────────────────────────────────
  const pendientes = lineas.filter((l, i) => l.estado !== 'encontrado' && mapeos[i]?.accion === 'sin_producto').length

  return (
    <div className="flex flex-col gap-5">
      {/* Cabecera del documento */}
      {cabecera && (
        <div className={cn(cardCls, 'p-5')}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Datos de la factura</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">N° Factura proveedor</p>
              <p className="font-mono font-semibold">{cabecera.numero_externo || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Fecha</p>
              <p className="font-semibold">{cabecera.fecha}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Proveedor (XML)</p>
              <p className="font-semibold">{cabecera.nombre_proveedor || cabecera.nit_proveedor || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="font-mono font-bold text-blue-700">{formatCOP(cabecera.total)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Proveedor y bodega */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Proveedor en el sistema <span className="text-red-500">*</span>
          </label>
          {proveedor ? (
            <div className="h-9 rounded-lg border border-emerald-300 bg-emerald-50 px-3 flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span className="font-medium text-emerald-800">{proveedor.razon_social}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="h-9 rounded-lg border border-amber-300 bg-amber-50 px-3 flex items-center gap-2 text-sm text-amber-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                NIT {cabecera?.nit_proveedor} no encontrado — selecciona manualmente:
              </div>
              <select
                value={proveedorId}
                onChange={e => setProveedorId(e.target.value)}
                className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Seleccionar proveedor —</option>
                {/* No podemos listar todos sin prop; en la práctica el usuario selecciona manualmente */}
              </select>
              <p className="text-xs text-gray-400">Si no aparece, <Link href="/compras/proveedores/nuevo" className="text-blue-600 hover:underline">créalo primero</Link> y vuelve a importar.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Bodega donde entra el stock <span className="text-red-500">*</span>
          </label>
          <select
            value={bodegaId}
            onChange={e => setBodegaId(e.target.value)}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Seleccionar bodega —</option>
            {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* Líneas */}
      <div className={cn(cardCls, 'overflow-hidden')}>
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Líneas de la factura ({lineas.length})
          </h3>
          {pendientes > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {pendientes} sin mapear
            </span>
          )}
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {lineas.map((l, i) => {
            const m = mapeos[i]
            if (!m) return null
            return (
              <div key={i} className="p-4 flex flex-col gap-3">
                {/* Info del producto en XML */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {l.codigo && (
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
                          {l.codigo}
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{l.descripcion}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {l.cantidad} × {formatCOP(l.precio_unitario)} = {formatCOP(l.total)}
                    </p>
                  </div>

                  {/* Badge estado */}
                  {l.estado === 'encontrado' ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">
                      <CheckCircle className="h-3 w-3" /> Encontrado
                    </span>
                  ) : l.estado === 'no_encontrado' ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">
                      <AlertCircle className="h-3 w-3" /> Sin mapear
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                      <Package className="h-3 w-3" /> Sin código
                    </span>
                  )}
                </div>

                {/* Producto encontrado */}
                {l.estado === 'encontrado' && (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>Mapeado a: <strong>{l.producto_codigo}</strong> — {l.producto_descripcion}</span>
                  </div>
                )}

                {/* Producto NO encontrado o sin código: mostrar opciones */}
                {(l.estado === 'no_encontrado' || l.estado === 'sin_codigo') && (
                  <div className="flex flex-col gap-3">
                    {/* Selector de acción */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setMapeo(i, 'accion', 'usar_existente')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          m.accion === 'usar_existente'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-blue-400'
                        }`}>
                        <LinkIcon className="h-3.5 w-3.5" /> Mapear a existente
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapeo(i, 'accion', 'crear_nuevo')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          m.accion === 'crear_nuevo'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-emerald-400'
                        }`}>
                        <Plus className="h-3.5 w-3.5" /> Crear producto nuevo
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapeo(i, 'accion', 'sin_producto')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          m.accion === 'sin_producto'
                            ? 'bg-gray-600 text-white border-gray-600'
                            : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-gray-400'
                        }`}>
                        <XCircle className="h-3.5 w-3.5" /> Sin producto (no mueve stock)
                      </button>
                    </div>

                    {/* Formulario mapear a existente */}
                    {m.accion === 'usar_existente' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500">Selecciona el producto en el sistema:</label>
                        <select
                          value={m.producto_id}
                          onChange={e => setMapeo(i, 'producto_id', e.target.value)}
                          className="h-9 rounded-lg border border-gray-300 bg-white dark:bg-gray-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">— Seleccionar producto —</option>
                          {productosDisp.map(p => (
                            <option key={p.id} value={p.id}>{p.codigo} — {p.descripcion}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-400">Se actualizará el precio de compra del producto seleccionado.</p>
                      </div>
                    )}

                    {/* Formulario crear nuevo */}
                    {m.accion === 'crear_nuevo' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-gray-500">Código nuevo <span className="text-red-500">*</span></label>
                          <input
                            value={m.nuevo_codigo}
                            onChange={e => setMapeo(i, 'nuevo_codigo', e.target.value.toUpperCase())}
                            placeholder="PROD001"
                            className="h-9 rounded-lg border border-gray-300 bg-white dark:bg-gray-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-gray-500">Descripción</label>
                          <input
                            value={m.nueva_descripcion}
                            onChange={e => setMapeo(i, 'nueva_descripcion', e.target.value)}
                            className="h-9 rounded-lg border border-gray-300 bg-white dark:bg-gray-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-gray-500">Precio venta</label>
                          <input
                            type="number"
                            value={m.nuevo_precio_venta}
                            onChange={e => setMapeo(i, 'nuevo_precio_venta', e.target.value)}
                            placeholder={String(l.precio_unitario)}
                            className="h-9 rounded-lg border border-gray-300 bg-white dark:bg-gray-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    )}

                    {m.accion === 'sin_producto' && (
                      <p className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded px-3 py-2">
                        Esta línea se registrará en la factura pero no moverá stock ni actualizará inventario.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { setPaso('subir'); setError(null); if (fileRef.current) fileRef.current.value = '' }}
          className="text-sm text-gray-500 hover:text-gray-700">
          ← Cargar otro XML
        </button>
        <button
          onClick={confirmar}
          disabled={cargando || !proveedorId || !bodegaId}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {cargando
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando…</>
            : <>Confirmar importación <ChevronRight className="h-4 w-4" /></>
          }
        </button>
      </div>
    </div>
  )
}
