'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Lock, ShieldCheck } from 'lucide-react'

const inputCls = 'flex h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-900/80 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-amber-400'

export default function CambiarPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('La contraseña debe tener mínimo 6 caracteres')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/cambiar-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    })
    const body = await res.json().catch(() => null)
    setLoading(false)

    if (!res.ok) {
      setError(body?.error ?? 'Error al cambiar la contraseña')
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-slate-50 to-orange-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 shadow-lg">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cambiar contraseña</h1>
            <p className="text-sm text-gray-500 dark:text-gray-300">
              Es tu primer inicio de sesión. Por seguridad, establece una nueva contraseña.
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white/95 p-8 shadow-xl backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/90">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                placeholder="Nueva contraseña"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
                minLength={6}
                className={inputCls}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                placeholder="Confirmar nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className={inputCls}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/25 dark:text-red-300">
                {error}
              </div>
            )}

            <Button type="submit" className="mt-2 h-10 w-full" disabled={loading}>
              {loading ? 'Guardando...' : 'Establecer nueva contraseña'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
