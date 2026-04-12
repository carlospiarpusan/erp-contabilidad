import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BarChart3, Boxes, Receipt, ShieldCheck, Wallet } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Funciones',
  description: 'Conoce los módulos de ClovEnt para ventas, compras, inventario, contabilidad y tesorería.',
  alternates: {
    canonical: 'https://www.clovent.co/funciones',
  },
}

const modules = [
  {
    title: 'Ventas',
    description: 'Cotizaciones, pedidos, facturas, recibos y seguimiento comercial.',
    icon: Receipt,
  },
  {
    title: 'Compras e inventario',
    description: 'Proveedores, compras, bodegas, stock y rotación del catálogo.',
    icon: Boxes,
  },
  {
    title: 'Contabilidad',
    description: 'Asientos, balances, auxiliares y reportes contables en tiempo real.',
    icon: BarChart3,
  },
  {
    title: 'Tesorería y control',
    description: 'Caja, pagos, flujo de efectivo, auditoría y permisos por rol.',
    icon: Wallet,
  },
]

export default function FuncionesPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Funciones</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-gray-950 sm:text-5xl">
            Un ERP para operar con más orden y menos fricción.
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            ClovEnt reúne procesos comerciales, inventario y contabilidad para que el negocio tenga una sola fuente de verdad.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {modules.map((module) => (
            <article key={module.title} className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-200/50">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700">
                <module.icon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-2xl font-bold text-gray-950">{module.title}</h2>
              <p className="mt-3 text-sm leading-7 text-gray-600">{module.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-[2rem] border border-teal-100 bg-teal-50 p-8">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 text-teal-700" />
            <div>
              <h2 className="text-xl font-bold text-teal-950">Control operativo con trazabilidad</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-teal-900/80">
                La plataforma está pensada para empresas que necesitan registrar ventas, compras, inventario y movimientos contables sin perder el contexto entre áreas.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700">
              Entrar a ClovEnt <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/registro" className="inline-flex h-11 items-center justify-center rounded-2xl border border-teal-200 bg-white px-5 text-sm font-semibold text-teal-800 hover:border-teal-300">
              Registrar empresa
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
