import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, BarChart3, Boxes, Building2, CheckCircle2, Receipt, ShieldCheck } from 'lucide-react'
import { BrandMark } from '@/components/brand/BrandMark'
import { getSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

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
]

export default async function MarketingHomePage() {
  const session = await getSession()
  if (session) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.16),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#ffffff_36%,#f8fafc_100%)] text-gray-950">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16 sm:px-8 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-4 py-1.5 text-sm font-medium text-teal-700 shadow-sm shadow-teal-500/5">
              <Building2 className="h-4 w-4" /> ERP colombiano para operación diaria
            </div>

            <div className="mt-8 flex items-center gap-4">
              <BrandMark size="xl" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-teal-700">ClovEnt</p>
                <h1 className="mt-1 text-4xl font-black tracking-[-0.05em] sm:text-5xl">
                  Ventas, compras, inventario y contabilidad en una sola plataforma.
                </h1>
              </div>
            </div>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-gray-600">
              ClovEnt ayuda a empresas a vender, comprar, controlar inventario y llevar su contabilidad sin saltar entre herramientas ni perder visibilidad del negocio.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-teal-600 px-6 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700"
              >
                Iniciar sesión <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/funciones"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-700 transition hover:border-teal-300 hover:text-teal-700"
              >
                Ver funciones
              </Link>
              <Link
                href="/contacto"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-700 transition hover:border-teal-300 hover:text-teal-700"
              >
                Solicitar demo
              </Link>
            </div>

            <ul className="mt-8 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
              {beneficios.map((item) => (
                <li key={item} className="flex items-start gap-2 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm shadow-gray-200/40">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-2xl shadow-teal-950/5 backdrop-blur">
            <div className="grid gap-4">
              {modulos.map((modulo) => (
                <article key={modulo.title} className="rounded-3xl border border-gray-100 bg-gray-50/70 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700">
                    <modulo.icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-lg font-bold text-gray-900">{modulo.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{modulo.description}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-teal-100 bg-teal-50/80 p-5 text-sm text-teal-900">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4" /> Control y trazabilidad
              </div>
              <p className="mt-2 leading-6 text-teal-800/90">
                Roles, auditoría y reportes para mantener claridad operativa a medida que el negocio crece.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
