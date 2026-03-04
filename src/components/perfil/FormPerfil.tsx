'use client'

import { useState } from 'react'
import { UsuarioRow } from '@/lib/db/usuarios'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { User, Lock, Check } from 'lucide-react'

interface Props { usuario: UsuarioRow }

export function FormPerfil({ usuario }: Props) {
  const supabase = createClient()
  const [nombre, setNombre]   = useState(usuario.nombre)
  const [telefono, setTelefono] = useState(usuario.telefono ?? '')
  const [newPass, setNewPass]  = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [msgPerfil, setMsgPerfil] = useState('')
  const [msgPass, setMsgPass]     = useState('')
  const [savingP, setSavingP] = useState(false)
  const [savingC, setSavingC] = useState(false)

  async function guardarPerfil(e: React.FormEvent) {
    e.preventDefault()
    setSavingP(true)
    setMsgPerfil('')
    const res = await fetch(`/api/usuarios/${usuario.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, telefono: telefono || null }),
    })
    setSavingP(false)
    setMsgPerfil(res.ok ? '✅ Perfil actualizado' : '❌ Error al guardar')
    setTimeout(() => setMsgPerfil(''), 3000)
  }

  async function cambiarContrasena(e: React.FormEvent) {
    e.preventDefault()
    if (newPass !== confirmPass) { setMsgPass('❌ Las contraseñas no coinciden'); return }
    if (newPass.length < 8) { setMsgPass('❌ Mínimo 8 caracteres'); return }
    setSavingC(true)
    setMsgPass('')
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setSavingC(false)
    if (error) { setMsgPass('❌ ' + error.message); return }
    setNewPass(''); setConfirmPass('')
    setMsgPass('✅ Contraseña actualizada')
    setTimeout(() => setMsgPass(''), 3000)
  }

  const rolNombre = usuario.roles?.nombre ?? 'sin rol'

  return (
    <div className="grid gap-6 max-w-2xl">

      {/* Info del usuario */}
      <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white text-2xl font-bold shadow">
          {nombre.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-gray-900 text-lg">{nombre}</p>
          <p className="text-sm text-gray-500">{usuario.email}</p>
          <span className="inline-block mt-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 capitalize">
            {rolNombre}
          </span>
        </div>
      </div>

      {/* Datos personales */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-4 w-4 text-gray-400" />
          <h2 className="font-semibold text-gray-800">Datos personales</h2>
        </div>
        <form onSubmit={guardarPerfil} className="flex flex-col gap-4">
          <Input
            label="Nombre completo"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
          />
          <Input
            label="Teléfono / WhatsApp"
            placeholder="+57 300 000 0000"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
          />
          <Input
            label="Correo electrónico"
            value={usuario.email}
            disabled
            className="bg-gray-50 text-gray-400"
          />
          {msgPerfil && (
            <p className={`text-sm ${msgPerfil.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
              {msgPerfil}
            </p>
          )}
          <Button type="submit" disabled={savingP} className="w-fit">
            {savingP ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </form>
      </div>

      {/* Cambiar contraseña */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-4 w-4 text-gray-400" />
          <h2 className="font-semibold text-gray-800">Cambiar contraseña</h2>
        </div>
        <form onSubmit={cambiarContrasena} className="flex flex-col gap-4">
          <Input
            label="Nueva contraseña"
            type="password"
            placeholder="Mínimo 8 caracteres"
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
            required
          />
          <Input
            label="Confirmar contraseña"
            type="password"
            placeholder="Repite la contraseña"
            value={confirmPass}
            onChange={e => setConfirmPass(e.target.value)}
            required
          />
          {msgPass && (
            <p className={`text-sm ${msgPass.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
              {msgPass}
            </p>
          )}
          <Button type="submit" variant="outline" disabled={savingC} className="w-fit">
            {savingC ? 'Actualizando...' : 'Cambiar contraseña'}
          </Button>
        </form>
      </div>
    </div>
  )
}
