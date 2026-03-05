'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Building2, Lock, User } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Usuario o contraseña incorrectos')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">ERP Contable</h1>
            <p className="text-sm text-gray-500">Maria Esperanza Tengana aux</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
          <h2 className="mb-6 text-center text-lg font-semibold text-gray-800">
            Ingresa a tu cuenta
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" className="mt-2 h-10 w-full" disabled={loading}>
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Ipiales, Nariño — Colombia 🇨🇴
        </p>
      </div>
    </div>
  )
}
