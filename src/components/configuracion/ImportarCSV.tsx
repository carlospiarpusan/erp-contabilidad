'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, CheckCircle, XCircle, FileText, Download, FileSpreadsheet } from 'lucide-react'
import { createXlsxBlob, parseCSVText, parseXlsxBuffer } from '@/lib/utils/csv'
import {
  type ImportEntity,
  IMPORT_COLUMNS,
  IMPORT_ENTITY_META,
  IMPORT_ENTITY_ORDER,
  IMPORT_EXAMPLE_ROWS,
} from '@/lib/import/migration'
import { cn, cardCls } from '@/utils/cn'

interface ResultadoFila {
  fila: number
  estado: 'ok' | 'error'
  mensaje?: string
  datos?: Record<string, string>
}

function generarCSVEjemplo(entidad: ImportEntity): string {
  const header = IMPORT_COLUMNS[entidad].map((column) => column.campo).join(',')
  return `${header}\n${IMPORT_EXAMPLE_ROWS[entidad].join(',')}`
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function getEntidadNote(entidad: ImportEntity) {
  switch (entidad) {
    case 'facturas-compra':
      return 'Las facturas historicas no mueven stock. El proveedor debe existir previamente.'
    case 'productos':
      return 'Si incluyes stock_actual o stock_minimo, se aplican sobre la bodega principal de la empresa.'
    case 'cuentas-puc':
      return 'Importa primero clases y grupos si vas a usar codigo_padre; asi el enlace padre se resuelve sin errores.'
    case 'asientos-contables':
      return 'Cada referencia se agrupa como un asiento. Debe y haber deben cuadrar exactamente.'
    default:
      return IMPORT_ENTITY_META[entidad].validationHint
  }
}

export function ImportarCSV({ initialEntidad = 'clientes' }: { initialEntidad?: ImportEntity }) {
  const [entidad, setEntidad] = useState<ImportEntity>(initialEntidad)
  const [filas, setFilas] = useState<Record<string, string>[]>([])
  const [resultados, setResultados] = useState<ResultadoFila[]>([])
  const [importando, setImportando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completado, setCompletado] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEntidad(initialEntidad)
    setFilas([])
    setResultados([])
    setCompletado(false)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [initialEntidad])

  function descargarEjemploCSV() {
    const csv = generarCSVEjemplo(entidad)
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `ejemplo_${entidad}.csv`)
  }

  function descargarEjemploXlsx() {
    const columnas = IMPORT_COLUMNS[entidad].map((columna) => columna.campo)
    const ejemplo = IMPORT_EXAMPLE_ROWS[entidad]
    downloadBlob(
      createXlsxBlob({
        headers: columnas,
        rows: [ejemplo],
        sheetName: `Importar ${entidad}`,
      }),
      `ejemplo_${entidad}.xlsx`
    )
  }

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResultados([])
    setCompletado(false)
    setError(null)

    try {
      const fileName = file.name.toLowerCase()
      const isXlsx = fileName.endsWith('.xlsx')
      const isCsv = fileName.endsWith('.csv') || fileName.endsWith('.txt')

      if (!isCsv && !isXlsx) {
        setError('Formato no soportado. Sube un archivo CSV o XLSX.')
        return
      }

      const parsedFile = isXlsx
        ? parseXlsxBuffer(await file.arrayBuffer())
        : parseCSVText(await file.text())

      const parsed = parsedFile.rows
      if (parsed.length === 0) {
        setError('El archivo no contiene datos validos')
        return
      }

      const requeridas = IMPORT_COLUMNS[entidad].filter((column) => column.requerido).map((column) => column.campo.toLowerCase())
      const faltantes = requeridas.filter((field) => !parsedFile.headers.includes(field))
      if (faltantes.length > 0) {
        setError(`Faltan columnas obligatorias: ${faltantes.join(', ')}`)
        return
      }

      setFilas(parsed)
    } catch {
      setError('Error al leer el archivo')
    }
  }

  function cambiarEntidad(nextEntidad: ImportEntity) {
    setEntidad(nextEntidad)
    setFilas([])
    setResultados([])
    setCompletado(false)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function importar() {
    if (filas.length === 0) return
    setImportando(true)
    setError(null)

    try {
      const res = await fetch(IMPORT_ENTITY_META[entidad].apiPath, {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setImportando(false)
    }
  }

  const exitosos = resultados.filter((row) => row.estado === 'ok').length
  const fallidos = resultados.filter((row) => row.estado === 'error').length
  const columnas = IMPORT_COLUMNS[entidad]
  const meta = IMPORT_ENTITY_META[entidad]

  return (
    <div className="flex flex-col gap-6">
      <div className={cn(cardCls, 'p-4')}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <FileSpreadsheet className="h-4 w-4 text-teal-600" />
            Importacion rapida por entidad
          </div>
          <div className="flex flex-wrap gap-2">
            {IMPORT_ENTITY_ORDER.map((item) => (
              <button
                key={item}
                onClick={() => cambiarEntidad(item)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                  entidad === item
                    ? 'border-teal-200 bg-teal-50 text-teal-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/50'
                )}
              >
                <span className="block font-medium">{IMPORT_ENTITY_META[item].shortLabel}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{IMPORT_ENTITY_META[item].description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={cn(cardCls, 'p-5')}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{meta.label}</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{meta.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={descargarEjemploCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
            >
              <Download className="h-3.5 w-3.5" />
              Plantilla CSV
            </button>
            <button
              onClick={descargarEjemploXlsx}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
            >
              <Download className="h-3.5 w-3.5" />
              Plantilla XLSX
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {columnas.map((column) => (
            <span
              key={column.campo}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium',
                column.requerido ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
              )}
            >
              {column.campo} {column.requerido ? '*' : ''}
            </span>
          ))}
        </div>

        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {getEntidadNote(entidad)}
        </p>
      </div>

      <div className="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
        <Upload className="mx-auto mb-3 h-8 w-8 text-gray-400" />
        <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">Sube tu archivo de migracion</p>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Formatos soportados: CSV y XLSX. La primera fila debe contener encabezados.</p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-700">
          <FileText className="h-4 w-4" />
          Seleccionar archivo
          <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" className="hidden" onChange={onArchivo} />
        </label>
      </div>

      {filas.length > 0 && (
        <div className={cn(cardCls, 'overflow-hidden')}>
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Vista previa: {filas.length} fila{filas.length !== 1 ? 's' : ''} detectadas
            </p>
            <button
              onClick={importar}
              disabled={importando}
              className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {importando ? 'Importando...' : `Importar ${filas.length} registros`}
            </button>
          </div>
          <div className="max-h-64 overflow-x-auto overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500">#</th>
                  {columnas.map((column) => (
                    <th key={column.campo} className="px-3 py-2 text-left text-gray-600 dark:text-gray-300">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filas.slice(0, 10).map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-1.5 text-gray-400">{index + 1}</td>
                    {columnas.map((column) => (
                      <td key={column.campo} className="max-w-48 truncate px-3 py-1.5 text-gray-700 dark:text-gray-300">
                        {row[column.campo] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
                {filas.length > 10 && (
                  <tr>
                    <td colSpan={columnas.length + 1} className="px-3 py-2 text-center text-gray-400">
                      ... y {filas.length - 10} filas mas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {completado && resultados.length > 0 && (
        <div className={cn(cardCls, 'p-5')}>
          <div className="mb-4 flex flex-wrap gap-6">
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
          {fallidos > 0 ? (
            <div className="space-y-1.5">
              {resultados.filter((row) => row.estado === 'error').map((row) => (
                <div key={`${row.fila}-${row.mensaje ?? ''}`} className="flex items-start gap-2 rounded px-3 py-1.5 text-sm text-red-600">
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>Fila {row.fila}: {row.mensaje}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300">La importacion termino sin errores.</p>
          )}
        </div>
      )}
    </div>
  )
}
