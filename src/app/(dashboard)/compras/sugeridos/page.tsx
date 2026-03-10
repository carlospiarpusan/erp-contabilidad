export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Lightbulb, PackageCheck, ShoppingCart, Truck } from 'lucide-react'
import { getSugeridoCompra } from '@/lib/db/informes'
import { formatCOP } from '@/utils/cn'
import { Badge } from '@/components/ui/badge'

interface PageProps {
  searchParams: Promise<{ q?: string; dias?: string; lead?: string; sin_movimiento?: string }>
}

function parseNumberParam(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function parseBooleanParam(value: string | undefined) {
  return value === '1' || value === 'true' || value === 'on'
}

export default async function SugeridosCompraPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const dias = parseNumberParam(sp.dias, 90, 30, 365)
  const lead = parseNumberParam(sp.lead, 30, 7, 120)
  const incluirSinMovimiento = parseBooleanParam(sp.sin_movimiento)
  const q = (sp.q ?? '').trim().toLowerCase()

  const { items: sugeridos, diagnostico } = await getSugeridoCompra({
    dias,
    lead_time: lead,
    incluir_sin_movimiento: incluirSinMovimiento,
  })
  const filas = q
    ? sugeridos.filter((r) =>
      (r.codigo ?? '').toLowerCase().includes(q) ||
      (r.descripcion ?? '').toLowerCase().includes(q) ||
      (r.familia ?? '').toLowerCase().includes(q)
    )
    : sugeridos

  const resumen = filas.reduce((acc, r) => ({
    productos: acc.productos + 1,
    urgentes: acc.urgentes + (r.prioridad === 'urgente' ? 1 : 0),
    unidades: acc.unidades + r.cantidad_sugerida,
    valor: acc.valor + r.valor_pedido,
  }), { productos: 0, urgentes: 0, unidades: 0, valor: 0 })
  const hayFiltroBusqueda = q.length > 0
  const sinResultadosPorBusqueda = hayFiltroBusqueda && sugeridos.length > 0 && filas.length === 0
  const sinHistorialProducto = diagnostico.sin_historial_producto

  const badgePorPrioridad: Record<string, 'danger' | 'warning' | 'info' | 'outline'> = {
    urgente: 'danger',
    media: 'warning',
    baja: 'info',
    sin_movimiento: 'outline',
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
          <Lightbulb className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Sugeridos de compra</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Recomendación automática por ventas, stock, cobertura y estacionalidad del mes
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Mostrando {filas.length.toLocaleString('es-CO')} de {sugeridos.length.toLocaleString('es-CO')} sugeridos
          </p>
        </div>
        <Link href="/compras/ordenes/nueva" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors">
          Crear orden
        </Link>
      </div>

      <form className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/85">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Buscar producto</label>
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="Código o descripción"
            className="h-9 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900/85 dark:text-gray-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Ventana ventas (días)</label>
          <input
            name="dias"
            type="number"
            min={30}
            max={365}
            defaultValue={dias}
            className="h-9 w-36 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900/85 dark:text-gray-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Lead time (días)</label>
          <input
            name="lead"
            type="number"
            min={7}
            max={120}
            defaultValue={lead}
            className="h-9 w-32 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900/85 dark:text-gray-100"
          />
        </div>
        <label className="flex items-center gap-2 self-end rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            name="sin_movimiento"
            value="1"
            defaultChecked={incluirSinMovimiento}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Incluir sin movimiento
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            Actualizar
          </button>
          <Link href="/compras/sugeridos" className="flex h-9 items-center rounded-lg border border-gray-300 px-4 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800/70">
            Limpiar
          </Link>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/85">
          <p className="text-xs text-gray-500 dark:text-gray-400">Productos a pedir</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{resumen.productos}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/85">
          <p className="text-xs text-gray-500 dark:text-gray-400">Urgentes</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{resumen.urgentes}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/85">
          <p className="text-xs text-gray-500 dark:text-gray-400">Unidades sugeridas</p>
          <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">{resumen.unidades.toLocaleString('es-CO')}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/85">
          <p className="text-xs text-gray-500 dark:text-gray-400">Valor estimado</p>
          <p className="mt-1 text-xl font-bold text-orange-700 dark:text-orange-300">{formatCOP(resumen.valor)}</p>
        </div>
      </div>

      {sinHistorialProducto && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">No hay historial de ventas por producto para calcular rotación.</p>
          <p className="mt-1">
            Esta empresa tiene <strong>{diagnostico.facturas_venta.toLocaleString('es-CO')}</strong> facturas de venta,
            pero <strong>{diagnostico.lineas_producto.toLocaleString('es-CO')}</strong> líneas asociadas a producto y
            <strong> {diagnostico.agregados_producto.toLocaleString('es-CO')}</strong> filas agregadas para sugeridos.
            Por ahora se muestran solo faltantes basados en stock actual y mínimos configurados.
          </p>
          {diagnostico.productos_con_stock_minimo === 0 && (
            <p className="mt-1">
              Además, no hay productos con stock mínimo configurado. Define mínimos para obtener sugeridos útiles aun sin histórico detallado.
            </p>
          )}
        </div>
      )}

      {!incluirSinMovimiento && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          {sinHistorialProducto
            ? <>No existe histórico por producto. Activa <strong>Incluir sin movimiento</strong> para revisar también artículos sin faltante, o configura stock mínimo para que el sugerido sea más útil.</>
            : <>Se ocultan por defecto los productos sin ventas ni histórico. Activa <strong>Incluir sin movimiento</strong> si quieres ver faltantes por stock negativo o mínimos no configurados.</>}
        </div>
      )}

      {filas.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-16 text-center dark:border-gray-700">
          <PackageCheck className="mx-auto mb-3 h-12 w-12 text-green-400" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
            {sinResultadosPorBusqueda
              ? 'No hay productos que coincidan con la búsqueda'
              : sinHistorialProducto
                ? 'No hay faltantes detectables sin historial por producto'
                : 'No hay sugeridos para pedir'}
          </p>
          <p className="text-sm text-gray-400">
            {sinResultadosPorBusqueda
              ? 'Ajusta el texto buscado o limpia el filtro para ver todos los sugeridos.'
              : sinHistorialProducto
                ? 'Las facturas actuales no tienen detalle por producto. Configura stock mínimo o importa líneas de venta para calcular rotación.'
                : 'Con los parámetros actuales no se detectan faltantes de reposición.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/85">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/80">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Producto</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Stock</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Mínimo</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Ventas ({dias}d)</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Ventas mes</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Prom. mes histórico</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Proyección 30d</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Cobertura</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Sugerido</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Costo</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">Prioridad</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filas.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/70">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{r.codigo}</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{r.descripcion}</p>
                    <p className="text-xs text-gray-400">{r.familia}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-200">{r.stock_actual.toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500 dark:text-gray-300">{r.stock_minimo.toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-200">{r.ventas_ventana.toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-200">{r.ventas_mes_actual.toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-200">{r.ventas_mes_historico_prom.toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-700 dark:text-blue-300">{r.proyeccion_mensual.toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3 text-right">
                    {r.dias_cobertura === null ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span className={r.dias_cobertura <= lead ? 'font-medium text-red-600' : 'font-medium text-gray-700 dark:text-gray-200'}>
                        {r.dias_cobertura.toLocaleString('es-CO')} días
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-orange-700 dark:text-orange-300">
                    {r.cantidad_sugerida.toLocaleString('es-CO')}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-gray-900 dark:text-gray-100">{formatCOP(r.valor_pedido)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={badgePorPrioridad[r.prioridad] ?? 'outline'}>{r.prioridad}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-300">{r.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200">
        <p className="flex items-center gap-2 font-medium">
          <Truck className="h-4 w-4" />
          Cálculo aplicado
        </p>
        {sinHistorialProducto ? (
          <>
            <p className="mt-1">
              Modo degradado: sin ventas por producto, el sugerido solo puede apoyarse en <strong>stock actual</strong>, <strong>stock mínimo</strong> y faltantes detectados.
            </p>
            <p className="mt-0.5">
              Para usar rotación y estacionalidad necesitas facturas con `documentos_lineas.producto_id` o una reimportación con detalle.
            </p>
          </>
        ) : (
          <>
            <p className="mt-1">
              Se recomienda compra para cubrir <strong>{lead + 15} días</strong> (lead time {lead} + 15 de seguridad), considerando ventas recientes, estacionalidad del mes y stock actual.
            </p>
            <p className="mt-0.5">
              Puedes ajustar la ventana de ventas y lead time para escenarios conservadores o agresivos.
            </p>
          </>
        )}
      </div>

      <Link href="/compras/ordenes" className="inline-flex w-fit items-center gap-2 text-sm text-blue-600 hover:underline dark:text-blue-300">
        <ShoppingCart className="h-4 w-4" />
        Ir a Órdenes de compra
      </Link>
    </div>
  )
}
