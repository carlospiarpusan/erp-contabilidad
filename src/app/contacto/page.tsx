import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, MapPin } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Habla con el equipo de ClovEnt para una demo, implementación o acompañamiento.',
  alternates: {
    canonical: 'https://www.clovent.co/contacto',
  },
}

export default function ContactoPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_0.9fr]">
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Contacto</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-gray-950">¿Quieres ver ClovEnt en tu operación?</h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Escríbenos y te ayudamos a revisar si ClovEnt encaja con tu proceso comercial, contable e inventario.
          </p>

          <div className="mt-10 grid gap-4">
            <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-200/40">
              <div className="flex items-center gap-3 text-gray-900">
                <Mail className="h-5 w-5 text-teal-700" />
                <span className="font-semibold">Correo</span>
              </div>
              <p className="mt-3 text-sm text-gray-600">info@clovent.co</p>
            </div>
            <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-200/40">
              <div className="flex items-center gap-3 text-gray-900">
                <MapPin className="h-5 w-5 text-teal-700" />
                <span className="font-semibold">Ubicación</span>
              </div>
              <p className="mt-3 text-sm text-gray-600">Ipiales, Nariño, Colombia</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-teal-100 bg-white p-8 shadow-sm shadow-teal-900/5">
          <h2 className="text-2xl font-bold text-gray-950">Siguiente paso</h2>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            Por ahora dejé una vía simple de contacto para no inventar un formulario sin backend. Si quieres, en la siguiente fase te monto un formulario real con validación y envío.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <a href="mailto:info@clovent.co?subject=Quiero%20una%20demo%20de%20ClovEnt" className="inline-flex h-12 items-center justify-center rounded-2xl bg-teal-600 px-6 text-sm font-semibold text-white hover:bg-teal-700">
              Escribir por correo
            </a>
            <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-2xl border border-gray-200 px-6 text-sm font-semibold text-gray-700 hover:border-teal-300 hover:text-teal-700">
              Ir al acceso
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
