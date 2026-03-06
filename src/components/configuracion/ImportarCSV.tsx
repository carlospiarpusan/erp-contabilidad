'use client'

import { useState, useRef } from 'react'
import { Upload, CheckCircle, XCircle, FileText, Download } from 'lucide-react'

type Entidad = 'clientes' | 'proveedores' | 'productos'

interface ResultadoFila {
  fila: number
  estado: 'ok' | 'error'
  mensaje?: string
  datos?: Record<string, string>
}

const COLUMNAS: Record<Entidad, { campo: string; label: string; requerido: boolean }[]> = {
  clientes: [
    { campo: 'razon_social', label: 'Razón Social', requerido: true },
    { campo: 'numero_documento', label: 'NIT/CC', requerido: true },
    { campo: 'tipo_documento', label: 'Tipo Doc (NIT/CC/CE)', requerido: false },
    { campo: 'email', label: 'Email', requerido: false },
    { campo: 'telefono', label: 'Teléfono', requerido: false },
    { campo: 'direccion', label: 'Dirección', requerido: false },
    { campo: 'ciudad', label: 'Ciudad', requerido: false },
  ],
  proveedores: [
    { campo: 'razon_social', label: 'Razón Social', requerido: true },
    { campo: 'numero_documento', label: 'NIT/CC', requerido: true },
    { campo: 'contacto', label: 'Contacto', requerido: false },
    { campo: 'email', label: 'Email', requerido: false },
    { campo: 'telefono', label: 'Teléfono', requerido: false },
    { campo: 'direccion', label: 'Dirección', requerido: false },
  ],
  productos: [
    { campo: 'codigo', label: 'Código', requerido: true },
    { campo: 'descripcion', label: 'Descripción', requerido: true },
    { campo: 'precio_venta', label: 'Precio Venta', requerido: true },
    { campo: 'precio_compra', label: 'Precio Compra', requerido: false },
    { campo: 'stock_actual', label: 'Stock Inicial', requerido: false },
    { campo: 'stock_minimo', label: 'Stock Mínimo', requerido: false },
    { campo: 'unidad', label: 'Unidad', requerido: false },
  ],
}

function parseCSV(texto: string): Record<string, string>[] {
  const lineas = texto.trim().split('\n')
  if (lineas.length < 2) return []
  const headers = lineas[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  return lineas.slice(1).map(linea => {
    const valores = linea.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = valores[i] ?? '' })
    return obj
  })
}

function generarCSVEjemplo(entidad: Entidad): string {
  const cols = COLUMNAS[entidad]
  const header = cols.map(c => c.campo).join(',')
  const ejemplo: Record<Entidad, string> = {
    clientes: 'Juan Pérez,123456789,CC,juan@email.com,3001234567,Calle 1 #2-3,Pasto',
    proveedores: 'Distribuciones SA,900123456,Contacto Ventas,ventas@dist.com,6021234567,Av Principal 45',
    productos: 'PROD001,Producto Ejemplo,25000,15000,100,10,UND',
  }
  return `${header}\n${ejemplo[entidad]}`
}

export function ImportarCSV() {
  const [entidad, setEntidad] = useState<Entidad>('clientes')
  const [filas, setFilas] = useState<Record<string, string>[]>([])
  const [resultados, setResultados] = useState<ResultadoFila[]>([])
  const [importando, setImportando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completado, setCompletado] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function descargarEjemplo() {
    const csv = generarCSVEjemplo(entidad)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ejemplo_${entidad}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResultados([])
    setCompletado(false)
    setError(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const texto = ev.target?.result as string
        const parsed = parseCSV(texto)
        if (parsed.length === 0) { setError('El archivo no contiene datos válidos'); return }
        setFilas(parsed)
      } catch {
        setError('Error al leer el archivo')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function importar() {
    if (filas.length === 0) return
    setImportando(true)
    setError(null)

    try {
      const res = await fetch(`/api/import/${entidad}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResultados(data.resultados ?? [])
      setCompletado(true)
      setFilas([])
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: any) {
      setError(e.message)
    } finally {
      setImportando(false)
    }
  }

  const exitosos  = resultados.filter(r => r.estado === 'ok').length
  const fallidos  = resultados.filter(r => r.estado === 'error').length
  const columnas  = COLUMNAS[entidad]

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs entidad */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {(['clientes', 'proveedores', 'productos'] as Entidad[]).map(e => (
          <button key={e} onClick={() => { setEntidad(e); setFilas([]); setResultados([]); setCompletado(false) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              entidad === e ? 'bg-white dark:bg-gray-900 shadow text-teal-600 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}>
            {e}
          </button>
        ))}
      </div>

      {/* Formato esperado */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Columnas del CSV para {entidad}</h3>
          <button onClick={descargarEjemplo}
            className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 hover:underline">
            <Download className="h-3.5 w-3.5" />
            Descargar ejemplo
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {columnas.map(c => (
            <span key={c.campo}
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${c.requerido ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'}`}>
              {c.campo} {c.requerido ? '*' : ''}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">* Los campos marcados son obligatorios. Primera fila = encabezados.</p>
      </div>

      {/* Subir archivo */}
      <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Arrastra un archivo CSV o</p>
        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700">
          <FileText className="h-4 w-4" />
          Seleccionar archivo CSV
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={onArchivo} />
        </label>
      </div>

      {/* Preview */}
      {filas.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Vista previa — {filas.length} fila{filas.length !== 1 ? 's' : ''} detectadas
            </p>
            <button onClick={importar} disabled={importando}
              className="px-4 py-1.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {importando ? 'Importando...' : `Importar ${filas.length} registros`}
            </button>
          </div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500">#</th>
                  {columnas.map(c => (
                    <th key={c.campo} className="px-3 py-2 text-left text-gray-600">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filas.slice(0, 10).map((f, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                    {columnas.map(c => (
                      <td key={c.campo} className="px-3 py-1.5 text-gray-700 dark:text-gray-300 max-w-32 truncate">
                        {f[c.campo] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
                {filas.length > 10 && (
                  <tr>
                    <td colSpan={columnas.length + 1} className="px-3 py-2 text-center text-gray-400">
                      ... y {filas.length - 10} filas más
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Resultados */}
      {completado && resultados.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
          <div className="flex gap-6 mb-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-semibold">{exitosos} importados</span>
            </div>
            {fallidos > 0 && (
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                <span className="font-semibold">{fallidos} con error</span>
              </div>
            )}
          </div>
          {fallidos > 0 && (
            <div className="space-y-1.5">
              {resultados.filter(r => r.estado === 'error').map(r => (
                <div key={r.fila} className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded px-3 py-1.5">
                  <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Fila {r.fila}: {r.mensaje}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
