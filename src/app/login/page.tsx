import type { Metadata } from 'next'
import { LoginPageClient } from '@/components/auth/LoginPageClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description: 'Acceso seguro a la plataforma ClovEnt.',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: 'https://www.clovent.co/login',
  },
}

export default function LoginPage() {
  return <LoginPageClient />
}
