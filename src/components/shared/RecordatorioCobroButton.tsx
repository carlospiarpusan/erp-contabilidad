'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'

interface Props {
  clienteId: string
  emailCliente: string
}

export function RecordatorioCobroButton({ clienteId, emailCliente }: Props) {
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function handleEnviar() {
    if (!confirm(`¿Enviar recordatorio de cobro a ${emailCliente}?`)) return
    setEstado('enviando')
    try {
      const res = await fetch('/api/email/recordatorio-cobro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: clienteId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEstado('ok')
      setMsg(`Enviado a ${data.enviado_a}`)
      setTimeout(() => setEstado('idle'), 3000)
    } catch (e) {
      setEstado('error')
      setMsg(e instanceof Error ? e.message : 'Error')
      setTimeout(() => setEstado('idle'), 4000)
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={handleEnviar}
        disabled={estado === 'enviando'}
        className="flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50"
      >
        <Mail className="h-3.5 w-3.5" />
        {estado === 'enviando' ? 'Enviando...' : estado === 'ok' ? '✓ Enviado' : 'Recordatorio'}
      </button>
      {msg && <p className={`text-xs ${estado === 'error' ? 'text-red-500' : 'text-green-600'}`}>{msg}</p>}
    </div>
  )
}
