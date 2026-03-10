'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

const TIPO_RUTA: Record<string, string> = {
  factura_venta: '/ventas/facturas',
  cotizacion: '/ventas/cotizaciones',
  pedido: '/ventas/pedidos',
  remision: '/ventas/remisiones',
}

interface Props {
  documentoId: string
  tipo: string
}

export function DuplicarButton({ documentoId, tipo }: Props) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)

  async function handleDuplicar() {
    if (!confirm('¿Duplicar este documento con fecha de hoy?')) return
    setCargando(true)
    try {
      const res = await fetch('/api/documentos/duplicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento_id: documentoId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const ruta = TIPO_RUTA[tipo] ?? '/ventas/facturas'
      router.push(`${ruta}/${data.id}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al duplicar')
    } finally {
      setCargando(false)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleDuplicar} disabled={cargando}>
      <Copy className="h-4 w-4 mr-1" /> {cargando ? 'Duplicando...' : 'Duplicar'}
    </Button>
  )
}
