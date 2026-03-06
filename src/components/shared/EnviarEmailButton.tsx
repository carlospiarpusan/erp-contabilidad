'use client'

import { useState } from 'react'
import { Mail, Check, X, Loader2 } from 'lucide-react'

interface Props {
  apiPath: string   // e.g. '/api/email/factura'
  docId: string
  emailCliente?: string | null
}

export function EnviarEmailButton({ apiPath, docId, emailCliente }: Props) {
  const [open, setOpen]       = useState(false)
  const [email, setEmail]     = useState(emailCliente ?? '')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ ok?: boolean; error?: string } | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setEnviando(true)
    setResultado(null)
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, email_destino: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResultado({ ok: true })
      setTimeout(() => { setOpen(false); setResultado(null) }, 2000)
    } catch (e: any) {
      setResultado({ error: e.message })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="relative">
      <button onClick={() => { setOpen(o => !o); setResultado(null) }}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
        <Mail className="h-4 w-4" /> Enviar email
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 shadow-lg p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Enviar por correo</p>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {resultado?.ok ? (
            <div className="flex items-center gap-2 text-emerald-600 text-sm py-2">
              <Check className="h-4 w-4" /> Correo enviado correctamente
            </div>
          ) : (
            <form onSubmit={enviar} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Dirección de correo</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="cliente@email.com" required
                  className="w-full h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {resultado?.error && (
                <p className="text-xs text-red-600">{resultado.error}</p>
              )}
              <button type="submit" disabled={enviando}
                className="h-9 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : 'Enviar'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
