import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://clovent.co'),
  title: {
    default: 'ClovEnt',
    template: '%s | ClovEnt',
  },
  description: 'ERP para ventas, compras, inventario y contabilidad.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  alternates: {
    canonical: 'https://clovent.co',
  },
  openGraph: {
    title: 'ClovEnt',
    description: 'ERP para ventas, compras, inventario y contabilidad.',
    url: 'https://clovent.co',
    siteName: 'ClovEnt',
    locale: 'es_CO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClovEnt',
    description: 'ERP para ventas, compras, inventario y contabilidad.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
