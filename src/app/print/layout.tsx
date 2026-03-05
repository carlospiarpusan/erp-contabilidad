import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import '../globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = { title: 'Impresión — ERP Contable' }

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geist.className} antialiased bg-white dark:bg-gray-900`}>
        {children}
      </body>
    </html>
  )
}
