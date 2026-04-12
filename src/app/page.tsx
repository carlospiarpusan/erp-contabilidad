import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BarChart3, Boxes, Building2, CheckCircle2, Clock3, Receipt, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { BrandMark } from '@/components/brand/BrandMark'

export const metadata: Metadata = {
  title: 'ERP para ventas, compras, inventario y contabilidad',
  description: 'ClovEnt centraliza ventas, compras, inventario y contabilidad para empresas que necesitan operar rápido y con control.',
  alternates: {
    canonical: 'https://www.clovent.co',
  },
  openGraph: {
    title: 'ClovEnt, ERP para ventas, compras, inventario y contabilidad',
    description: 'Centraliza ventas, compras, inventario y contabilidad en una sola operación.',
    url: 'https://www.clovent.co',
    images: ['/clovent-icon.svg'],
  },
  twitter: {
    title: 'ClovEnt, ERP para ventas, compras, inventario y contabilidad',
    description: 'Centraliza ventas, compras, inventario y contabilidad en una sola operación.',
    images: ['/clovent-icon.svg'],
  },
}

const modulos = [
  {
    title: 'Ventas y facturación',
    description: 'Cotizaciones, pedidos, facturas, recaudos y seguimiento comercial desde un solo flujo.',
    icon: Receipt,
  },
  {
    title: 'Compras e inventario',
    description: 'Control de proveedores, entradas, stock, rotación y sugeridos de compra.',
    icon: Boxes,
  },
  {
    title: 'Contabilidad y tesorería',
    description: 'Asientos, balances, cuentas por cobrar y por pagar con trazabilidad diaria.',
    icon: BarChart3,
  },
]

const beneficios = [
  'Multiempresa con control de acceso por rol',
  'Migración desde hojas de cálculo y catálogos existentes',
  'Operación pensada para negocios en Colombia',
  'Reportes listos para tomar decisiones cada día',
]

const metricas = [
  { valor: '1 sola', texto: 'plataforma para operar ventas, compras, inventario y contabilidad' },
  { valor: '24/7', texto: 'visibilidad del negocio con trazabilidad y control por rol' },
  { valor: 'Más orden', texto: 'menos reprocesos y menos salto entre hojas y sistemas' },
]

const diferenciales = [
  {
    title: 'Menos trabajo manual',
    description: 'Reduce doble digitación y consolida la operación comercial y contable en el mismo flujo.',
    icon: Sparkles,
  },
  {
    title: 'Respuesta más rápida',
    description: 'Consulta cartera, stock, compras y desempeño sin perseguir datos en varios lados.',
    icon: Clock3,
  },
  {
    title: 'Crecimiento con control',
    description: 'Roles, auditoría y reportes para operar mejor a medida que crece la empresa.',
    icon: TrendingUp,
  },
]

export default function MarketingHomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.18),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#ffffff_38%,#f8fafc_100%)] text-gray-950">
      <section className="mx-auto w-full max-w-6xl px-6 pb-12 pt-6 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between rounded-full border border-white/70 bg-white/80 px-4 py-3 shadow-sm shadow-gray-200/50 backdrop-blur">
          <div className="flex items-center gap-3">
            <BrandMark size="md" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">ClovEnt</p>
              <p className="text-xs text-gray-500">ERP colombiano para operación diaria</p>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <Link href="/funciones" className="text-sm font-medium text-gray-600 transition hover:text-teal-700">Funciones</Link>
            <Link href="/precios" className="text-sm font-medium text-gray-600 transition hover:text-teal-700">Precios</Link>
            <Link href="/login" className="inline-flex h-10 items-center justify-center rounded-full border border-gray-200 px-5 text-sm font-semibold text-gray-700 transition hover:border-teal-300 hover:text-teal-700">Iniciar sesión</Link>
            <Link href="/registro" className="inline-flex h-10 items-center justify-center rounded-full bg-gray-950 px-5 text-sm font-semibold text-white transition hover:bg-teal-700">Registrar empresa</Link>
          </div>
        </div>

        <div className="grid min-h-[calc(100vh-7rem)] gap-12 py-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-4 py-1.5 text-sm font-medium text-teal-700 shadow-sm shadow-teal-500/5">
              <Building2 className="h-4 w-4" /> ERP colombiano para comercializadoras y empresas operativas
            </div>

            <h1 className="mt-8 max-w-4xl text-4xl font-black tracking-[-0.05em] text-gray-950 sm:text-5xl lg:text-6xl">
              Ventas, compras, inventario y contabilidad, en una sola plataforma clara.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
              ClovEnt ayuda a operar más rápido, con menos reprocesos y mejor control del negocio. Todo queda conectado, desde la venta hasta la contabilidad.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/registro"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-teal-600 px-6 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700"
              >
                Registrar empresa <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/funciones"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-700 transition hover:border-teal-300 hover:text-teal-700"
              >
                Ver funciones
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-700 transition hover:border-teal-300 hover:text-teal-700"
              >
                Iniciar sesión
              </Link>
            </div>

            <ul className="mt-8 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
              {beneficios.map((item) => (
                <li key={item} className="flex items-start gap-2 rounded-2xl border border-white/70 bg-white/75 px-4 py-3 shadow-sm shadow-gray-200/40">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {metricas.map((item) => (
                <div key={item.valor} className="rounded-3xl border border-white/70 bg-white/80 px-4 py-5 shadow-sm shadow-gray-200/40">
                  <p className="text-xl font-black tracking-[-0.03em] text-gray-950">{item.valor}</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{item.texto}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-2xl shadow-teal-950/5 backdrop-blur lg:p-7">
            <div className="rounded-[1.75rem] border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-teal-700">Operación conectada</p>
                  <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-gray-950">Todo en una sola vista</h2>
                </div>
                <BrandMark size="lg" className="shadow-[0_18px_40px_rgba(19,148,135,0.18)]" />
              </div>
              <p className="mt-4 text-sm leading-6 text-teal-900/80">
                Unifica ventas, compras, inventario y contabilidad para que el equipo trabaje con la misma información y el mismo criterio operativo.
              </p>
            </div>

            <div className="mt-5 grid gap-4">
              {modulos.map((modulo) => (
                <article key={modulo.title} className="rounded-3xl border border-gray-100 bg-gray-50/70 p-5 transition hover:border-teal-200 hover:bg-white">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700">
                    <modulo.icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-lg font-bold text-gray-900">{modulo.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{modulo.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-6 py-12 sm:px-8 lg:grid-cols-3 lg:px-10">
          {diferenciales.map((item) => (
            <article key={item.title} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm shadow-gray-200/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-gray-950">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-14 sm:px-8 lg:px-10">
        <div className="rounded-[2rem] border border-teal-100 bg-gradient-to-br from-teal-600 to-emerald-600 px-6 py-10 text-white shadow-xl shadow-teal-700/20 sm:px-8 lg:flex lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-teal-100">ClovEnt</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">Haz que la operación deje de depender de hojas sueltas.</h2>
            <p className="mt-4 text-sm leading-7 text-teal-50/90">
              Registra tu empresa y empieza a ordenar ventas, compras, inventario y contabilidad en un solo flujo.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
            <Link href="/registro" className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-6 text-sm font-semibold text-teal-700 transition hover:bg-teal-50">Registrar empresa</Link>
            <Link href="/precios" className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/30 px-6 text-sm font-semibold text-white transition hover:bg-white/10">Ver planes</Link>
          </div>
        </div>
      </section>

      <section className="pb-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 text-sm text-gray-500 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" />
            <span>ClovEnt, ERP para ventas, compras, inventario y contabilidad.</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/funciones" className="transition hover:text-teal-700">Funciones</Link>
            <Link href="/precios" className="transition hover:text-teal-700">Precios</Link>
            <Link href="/contacto" className="transition hover:text-teal-700">Contacto</Link>
            <Link href="/login" className="transition hover:text-teal-700">Login</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
