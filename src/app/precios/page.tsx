import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Precios',
  description: 'Planes de cobro de ClovEnt para empresas que necesitan ventas, compras, inventario y contabilidad en una sola plataforma.',
  alternates: {
    canonical: 'https://www.clovent.co/precios',
  },
}

const included = [
  'Acceso multiempresa y usuarios con roles',
  'Ventas, compras, inventario y contabilidad en una sola plataforma',
  'Acompañamiento para activación y puesta en marcha',
]

const billingModes = [
  {
    name: 'Cobro mensual',
    description: 'Para empresas que prefieren empezar con una inversión inicial más ligera y pago recurrente mes a mes.',
  },
  {
    name: 'Cobro anual',
    description: 'Para empresas que quieren estabilidad operativa y una negociación cerrada por periodos más largos.',
  },
  {
    name: 'Implementación',
    description: 'Incluye la activación inicial, parametrización base y acompañamiento para dejar la empresa operando.',
  },
]

export default function PreciosPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[2rem] border border-gray-100 bg-slate-50 p-8 shadow-sm shadow-gray-200/40 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Precios</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-gray-950">Planes de cobro de ClovEnt</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">
            Dejé esta página lista con la estructura comercial correcta, separando modalidad mensual, anual e implementación. Me falta únicamente cargar los valores exactos de tus planes actuales para publicarlos sin inventar cifras.
          </p>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Pendiente de valor exacto</p>
                <p className="mt-1">
                  Revisé memoria y repo, pero los montos reales de los planes no están guardados aquí. En cuanto me pases los valores, te dejo esta página cerrada con los precios definitivos.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {billingModes.map((item) => (
            <article key={item.name} className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-200/30">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Modalidad</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-gray-950">{item.name}</h2>
              <p className="mt-4 text-sm leading-7 text-gray-600">{item.description}</p>

              <div className="mt-6 grid gap-3">
                {included.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
                    <span className="text-sm leading-6 text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/registro" className="inline-flex h-12 items-center justify-center rounded-2xl bg-teal-600 px-6 text-sm font-semibold text-white hover:bg-teal-700">
            Registrar empresa
          </Link>
          <Link href="/registro" className="inline-flex h-12 items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-700 hover:border-teal-300 hover:text-teal-700">
            Registrar empresa
          </Link>
          <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-700 hover:border-teal-300 hover:text-teal-700">
            Iniciar sesión
          </Link>
        </div>
      </div>
    </main>
  )
}
