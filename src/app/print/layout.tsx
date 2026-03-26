import type { Metadata } from 'next'
import '../globals.css'

export const metadata: Metadata = { title: 'Impresión', description: 'Documentos imprimibles de ClovEnt' }

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased bg-white dark:bg-gray-900">
        {children}
      </body>
    </html>
  )
}
