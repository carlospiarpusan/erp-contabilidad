import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Building2,
  ClipboardCheck,
  FileClock,
  FolderSync,
  Landmark,
  Package,
  Receipt,
  Scale,
  Settings2,
  Users,
} from 'lucide-react'
import { ImportarCSV } from '@/components/configuracion/ImportarCSV'
import type { HistorialImportacionItem } from '@/lib/db/importaciones'
import { type ImportEntity, IMPORT_ENTITY_META } from '@/lib/import/migration'
import { cardCls, cn } from '@/utils/cn'

interface CentroMigracionProps {
  initialEntidad: ImportEntity
  historial: HistorialImportacionItem[]
}

type MigrationAction = {
  label: string
  href: string
  accent?: 'teal' | 'blue' | 'gray'
}

type MigrationStep = {
  numero: string
  titulo: string
  descripcion: string
  icon: typeof Settings2
  acciones: readonly MigrationAction[]
}

const IMPORT_CARDS: readonly { entidad: ImportEntity; accent: string }[] = [
  { entidad: 'cuentas-puc', accent: 'bg-blue-50 text-blue-700 border-blue-200' },
  { entidad: 'clientes', accent: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { entidad: 'proveedores', accent: 'bg-orange-50 text-orange-700 border-orange-200' },
  { entidad: 'productos', accent: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { entidad: 'asientos-contables', accent: 'bg-violet-50 text-violet-700 border-violet-200' },
  { entidad: 'facturas-compra', accent: 'bg-amber-50 text-amber-700 border-amber-200' },
] as const

const MIGRATION_STEPS: readonly MigrationStep[] = [
  {
    numero: '1',
    titulo: 'Base contable y parametros',
    descripcion: 'Comienza con el PUC y luego revisa impuestos, formas de pago, bodegas y consecutivos para que el resto de la migracion no quede desconectado.',
    icon: BookOpen,
    acciones: [
      { label: 'Importar PUC', href: '/configuracion/importar?entidad=cuentas-puc', accent: 'teal' },
      { label: 'Impuestos', href: '/contabilidad/impuestos', accent: 'gray' },
      { label: 'Formas de pago', href: '/contabilidad/formas-pago', accent: 'gray' },
      { label: 'Bodegas', href: '/configuracion/bodegas', accent: 'gray' },
      { label: 'Consecutivos', href: '/contabilidad/consecutivos', accent: 'gray' },
    ],
  },
  {
    numero: '2',
    titulo: 'Terceros y responsables',
    descripcion: 'Carga clientes y proveedores antes de documentos. Los acreedores y colaboradores se completan desde sus modulos dedicados.',
    icon: Users,
    acciones: [
      { label: 'Importar clientes', href: '/configuracion/importar?entidad=clientes', accent: 'teal' },
      { label: 'Importar proveedores', href: '/configuracion/importar?entidad=proveedores', accent: 'teal' },
      { label: 'Acreedores', href: '/gastos/acreedores', accent: 'gray' },
      { label: 'Colaboradores', href: '/configuracion/colaboradores', accent: 'gray' },
    ],
  },
  {
    numero: '3',
    titulo: 'Catalogo, productos y precios',
    descripcion: 'Con los terceros listos, migra productos y luego ajusta listas de precios y atributos comerciales.',
    icon: Package,
    acciones: [
      { label: 'Importar productos', href: '/configuracion/importar?entidad=productos', accent: 'teal' },
      { label: 'Lista de precios', href: '/ventas/precios', accent: 'gray' },
      { label: 'Fabricantes', href: '/productos/fabricantes', accent: 'gray' },
      { label: 'Familias', href: '/productos/familias', accent: 'gray' },
    ],
  },
  {
    numero: '4',
    titulo: 'Inventario inicial',
    descripcion: 'Usa la importacion de productos con stock_actual y stock_minimo para cargar existencia inicial en la bodega principal.',
    icon: Boxes,
    acciones: [
      { label: 'Abrir importador de inventario', href: '/configuracion/importar?entidad=productos', accent: 'teal' },
      { label: 'Ajuste inventario', href: '/inventario/ajuste', accent: 'gray' },
      { label: 'Kardex', href: '/inventario/kardex', accent: 'gray' },
    ],
  },
  {
    numero: '5',
    titulo: 'Saldos iniciales contables',
    descripcion: 'Para balances de apertura o reclasificaciones, importa asientos manuales ya cuadrados por referencia.',
    icon: Scale,
    acciones: [
      { label: 'Importar asientos', href: '/configuracion/importar?entidad=asientos-contables', accent: 'teal' },
      { label: 'Libro de asientos', href: '/contabilidad/asientos', accent: 'gray' },
    ],
  },
  {
    numero: '6',
    titulo: 'Cartera y cuentas por pagar abiertas',
    descripcion: 'Migra solo documentos pendientes de cobro o pago si realmente los necesitas operar en ClovEnt.',
    icon: Landmark,
    acciones: [
      { label: 'Facturas de compra historicas', href: '/configuracion/importar?entidad=facturas-compra', accent: 'teal' },
      { label: 'Cuentas por pagar', href: '/informes/cuentas-por-pagar', accent: 'gray' },
      { label: 'Cartera', href: '/informes/cartera', accent: 'gray' },
    ],
  },
  {
    numero: '7',
    titulo: 'Historicos y soporte documental',
    descripcion: 'Solo al final trae historicos que realmente vas a consultar. La factura electronica DIAN sigue siendo un flujo operativo aparte.',
    icon: FileClock,
    acciones: [
      { label: 'Facturas compra historicas', href: '/configuracion/importar?entidad=facturas-compra', accent: 'teal' },
      { label: 'Importar factura DIAN', href: '/compras/facturas/importar', accent: 'blue' },
      { label: 'Exportaciones', href: '/informes/exportaciones', accent: 'gray' },
    ],
  },
] as const

function actionCls(accent: MigrationAction['accent']) {
  if (accent === 'teal') return 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100'
  if (accent === 'blue') return 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
  return 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/50'
}

function getHistorialLabel(tabla: string) {
  const map: Record<string, string> = {
    import_clientes: 'Clientes',
    import_proveedores: 'Proveedores',
    import_productos: 'Productos',
    import_facturas_compra: 'Facturas compra',
    import_cuentas_puc: 'PUC',
    import_asientos_contables: 'Asientos',
  }
  return map[tabla] ?? tabla
}

export function CentroMigracion({ initialEntidad, historial }: CentroMigracionProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className={cn(cardCls, 'overflow-hidden')}>
        <div className="grid gap-6 p-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
              <FolderSync className="h-3.5 w-3.5" />
              Migracion e importacion
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Centro de migracion para ClovEnt</h1>
              <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">
                Esta ruta centraliza la migracion desde otro software sin mezclarla con procesos operativos del ERP.
                Usa el orden recomendado, descarga plantillas y entra a cada modulo solo como acceso secundario.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/60">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Migrar desde otro sistema</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Sigue el orden: parametros, terceros, catalogo, inventario, saldos y documentos abiertos.
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/60">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Separado de DIAN</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  La ruta de factura electronica sigue en compras porque es operacion diaria, no migracion masiva.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-emerald-50 p-5 dark:border-teal-900/40 dark:from-teal-950/30 dark:via-gray-900 dark:to-emerald-950/20">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Importacion rapida</p>
            <div className="mt-4 space-y-3">
              {IMPORT_CARDS.map(({ entidad, accent }) => {
                const meta = IMPORT_ENTITY_META[entidad]
                return (
                  <Link
                    key={entidad}
                    href={`/configuracion/importar?entidad=${entidad}#importador`}
                    className={cn('block rounded-xl border p-3 transition-colors', accent)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{meta.shortLabel}</p>
                        <p className="mt-1 text-xs opacity-80">{meta.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 flex-shrink-0" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {MIGRATION_STEPS.map((step) => (
          <article key={step.numero} className={cn(cardCls, 'p-5')}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">Paso {step.numero}</p>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{step.titulo}</h2>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{step.descripcion}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {step.acciones.map((action) => (
                <Link
                  key={`${step.numero}-${action.href}-${action.label}`}
                  href={action.href}
                  className={cn('inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors', actionCls(action.accent))}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className={cn(cardCls, 'p-5')}>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <ClipboardCheck className="h-4 w-4 text-teal-600" />
            Plantillas y validaciones
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            Cada plantilla usa encabezados obligatorios. Si el archivo no cuadra, la importacion falla por fila y deja trazabilidad en historial.
          </p>
        </div>
        <div className={cn(cardCls, 'p-5')}>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <Building2 className="h-4 w-4 text-teal-600" />
            Dato maestro primero
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            Evita importar documentos antes de tener terceros, PUC, impuestos, bodegas y productos consistentes.
          </p>
        </div>
        <div className={cn(cardCls, 'p-5')}>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <Receipt className="h-4 w-4 text-teal-600" />
            Operacion diaria aparte
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            La factura DIAN, los ZIP/XML y la homologacion proveedor-producto no se mezclan con este centro de migracion masiva.
          </p>
          <Link href="/compras/facturas/importar" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline">
            Ir a importar factura DIAN
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className={cn(cardCls, 'p-5')}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Historial de importaciones</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ultimas ejecuciones registradas desde este centro.</p>
          </div>
        </div>
        {historial.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Todavia no hay importaciones registradas para esta empresa.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 text-left dark:border-gray-800">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-500">Fecha</th>
                  <th className="px-3 py-2 font-medium text-gray-500">Entidad</th>
                  <th className="px-3 py-2 font-medium text-gray-500">Resultado</th>
                  <th className="px-3 py-2 font-medium text-gray-500">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {historial.map((item) => {
                  const resumen = item.datos_nuevos ?? {}
                  const exitosos = Number(resumen.exitosos ?? 0)
                  const fallidos = Number(resumen.fallidos ?? 0)
                  return (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                        {new Date(item.created_at).toLocaleString('es-CO')}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                        {getHistorialLabel(item.tabla)}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                        {resumen.total ?? '—'} fila(s) / {exitosos} ok / {fallidos} error(es)
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                        {resumen.detalle ?? 'Importacion registrada en auditoria'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="importador" className="scroll-mt-24">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Importar ahora</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Entidad seleccionada: {IMPORT_ENTITY_META[initialEntidad].label}
          </p>
        </div>
        <ImportarCSV initialEntidad={initialEntidad} />
      </section>
    </div>
  )
}
