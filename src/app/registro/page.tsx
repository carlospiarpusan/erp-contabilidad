import type { Metadata } from 'next'
import { RegisterPageClient } from '@/components/auth/RegisterPageClient'

export const metadata: Metadata = {
  title: 'Registrar empresa',
  description: 'Crea tu empresa en ClovEnt y obtén el acceso inicial de administrador.',
  alternates: {
    canonical: 'https://www.clovent.co/registro',
  },
}

export default function RegistroPage() {
  return <RegisterPageClient />
}
