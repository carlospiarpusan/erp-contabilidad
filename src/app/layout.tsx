import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ERP Contable — Maria Esperanza Tengana',
  description: 'Sistema de gestión empresarial y contabilidad',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geist.className} antialiased bg-gray-50`}>
        {children}
      </body>
    </html>
  )
}
