import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Precios',
  description: 'Solicita una demo de ClovEnt y recibe una propuesta acorde a tu operación.',
  alternates: {
    canonical: 'https://www.clovent.co/precios',
  },
}

const items = [
  'Implementación orientada a tu operación',
  'Soporte para múltiples empresas y usuarios',
  'Módulos según ventas, compras, inventario y contabilidad',
]

export default function PreciosPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-gray-100 bg-slate-50 p-8 shadow-sm shadow-gray-200/40 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Precios</p>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-gray-950">Cotización ajustada a tu negocio</h1>
        <p className="mt-5 text-lg leading-8 text-gray-600">
          ClovEnt no se vende como una caja cerrada. La propuesta depende del tamaño de la operación, los módulos que necesites y el nivel de acompañamiento en la puesta en marcha.
        </p>

        <div className="mt-8 grid gap-3">
          {items.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-2xl border border-white bg-white px-4 py-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
              <span className="text-sm leading-7 text-gray-700">{item}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/contacto" className="inline-flex h-12 items-center justify-center rounded-2xl bg-teal-600 px-6 text-sm font-semibold text-white hover:bg-teal-700">
            Solicitar propuesta
          </Link>
          <Link href="/funciones" className="inline-flex h-12 items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-700 hover:border-teal-300 hover:text-teal-700">
            Ver funciones
          </Link>
        </div>
      </div>
    </main>
  )
}
