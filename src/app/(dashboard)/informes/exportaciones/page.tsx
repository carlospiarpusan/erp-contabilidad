export const dynamic = 'force-dynamic'

import { Download, FileSpreadsheet, Filter, FolderOutput } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { EXPORT_GROUP_LABELS, getVisibleExports, type ExportDefinition, type ExportField } from '@/lib/export/registry'
import { cardCls, cn } from '@/utils/cn'

function formatDateInput(date: Date) {
  return date.toISOString().split('T')[0]
}

function getDefaultFieldValue(field: ExportField, today: Date) {
  if (field.defaultValue === 'today') return formatDateInput(today)
  if (field.defaultValue === 'startOfYear') return `${today.getFullYear()}-01-01`
  return ''
}

function ExportCard({ item, today }: { item: ExportDefinition; today: Date }) {
  return (
    <div className={cn(cardCls, 'p-5 flex flex-col gap-4')}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{item.title}</h3>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
              {item.format}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
        </div>
      </div>

      <form action={item.route} method="GET" className="flex flex-col gap-4">
        {item.fields?.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {item.fields.map((field) => (
              <label key={field.name} className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {field.label}
                </span>
                <input
                  type={field.type}
                  name={field.name}
                  defaultValue={getDefaultFieldValue(field, today)}
                  placeholder={field.placeholder}
                  className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
            Sin filtros obligatorios. La exportación usa el estado actual de tus datos.
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Filter className="h-3.5 w-3.5" />
            Descarga directa, sin pasos intermedios.
          </div>
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            Descargar CSV
          </button>
        </div>
      </form>
    </div>
  )
}

export default async function ExportacionesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const today = new Date()
  const exports = getVisibleExports(session.rol)
  const grouped = Object.entries(EXPORT_GROUP_LABELS).map(([group, label]) => ({
    group,
    label,
    items: exports.filter((item) => item.group === group),
  })).filter((section) => section.items.length > 0)

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <FolderOutput className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Centro de exportaciones</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Exportaciones operativas, contables y maestras agrupadas en un solo lugar.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-100">
        Este módulo sigue el flujo habitual de software contable: elegir reporte, ajustar filtros y descargar un formato consistente. La primera versión centraliza CSV; la estructura queda lista para sumar historial y formatos adicionales.
      </div>

      {grouped.map((section) => (
        <section key={section.group} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
              {section.label}
            </h2>
            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {section.items.map((item) => (
              <ExportCard key={item.id} item={item} today={today} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
