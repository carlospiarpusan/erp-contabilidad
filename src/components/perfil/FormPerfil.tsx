'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { UsuarioRow } from '@/lib/db/usuarios'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { User, Lock, ShieldCheck, Smartphone } from 'lucide-react'
import { getRoleLabelFromId } from '@/lib/auth/permissions'
import { cn, cardCls } from '@/utils/cn'

interface Props { usuario: UsuarioRow }

export function FormPerfil({ usuario }: Props) {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [nombre, setNombre] = useState(usuario.nombre)
  const [telefono, setTelefono] = useState(usuario.telefono ?? '')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [msgPerfil, setMsgPerfil] = useState('')
  const [msgPass, setMsgPass] = useState('')
  const [savingP, setSavingP] = useState(false)
  const [savingC, setSavingC] = useState(false)
  const [mfaLoading, setMfaLoading] = useState(false)
  const [mfaMsg, setMfaMsg] = useState('')
  const [qrCodeSvg, setQrCodeSvg] = useState('')
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null)
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null)
  const [aal, setAal] = useState<string>('aal1')
  const [codigoMfa, setCodigoMfa] = useState('')
  const [privacyLoading, setPrivacyLoading] = useState(false)
  const [privacyMsg, setPrivacyMsg] = useState('')
  const [privacyVersion, setPrivacyVersion] = useState('')
  const [ultimoConsentimiento, setUltimoConsentimiento] = useState<string | null>(null)

  async function guardarPerfil(e: React.FormEvent) {
    e.preventDefault()
    setSavingP(true)
    setMsgPerfil('')
    const res = await fetch('/api/perfil', {
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

  const cargarMFA = useCallback(async () => {
    setMfaLoading(true)
    try {
      const [factorsRes, aalRes] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ])
      if (factorsRes.error) throw factorsRes.error
      if (aalRes.error) throw aalRes.error

      const verified = (factorsRes.data?.totp ?? [])[0]
      const pending = (factorsRes.data?.all ?? []).find((f) => f.factor_type === 'totp' && f.status === 'unverified')

      setVerifiedFactorId(verified?.id ?? null)
      setPendingFactorId(pending?.id ?? null)
      if (!pending) setQrCodeSvg('')
      setAal(aalRes.data?.currentLevel ?? 'aal1')
    } catch (e: unknown) {
      setMfaMsg(`❌ ${e instanceof Error ? e.message : 'Error cargando MFA'}`)
    } finally {
      setMfaLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void cargarMFA()
  }, [cargarMFA])

  useEffect(() => {
    let cancelled = false

    async function cargarConsentimientos() {
      try {
        const res = await fetch('/api/perfil/consentimientos')
        const data = await res.json().catch(() => null)
        if (!res.ok || cancelled) return
        setPrivacyVersion(typeof data?.politica_actual === 'string' ? data.politica_actual : '')
        setUltimoConsentimiento(data?.consentimientos?.[0]?.aceptado_en ?? null)
      } catch {
        if (!cancelled) setPrivacyMsg('No se pudo cargar el estado de privacidad.')
      }
    }

    void cargarConsentimientos()
    return () => {
      cancelled = true
    }
  }, [])

  async function activarMFA() {
    setMfaLoading(true)
    setMfaMsg('')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'ClovEnt',
      })
      if (error || !data?.id || !data.totp?.qr_code) throw error ?? new Error('No se pudo iniciar MFA')
      setPendingFactorId(data.id)
      setQrCodeSvg(data.totp.qr_code)
      setMfaMsg('Escanea el QR con Google Authenticator/Authy y verifica el código.')
    } catch (e: unknown) {
      setMfaMsg(`❌ ${e instanceof Error ? e.message : 'No se pudo activar MFA'}`)
    } finally {
      setMfaLoading(false)
    }
  }

  async function verificarMFA(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingFactorId || !codigoMfa.trim()) return
    setMfaLoading(true)
    setMfaMsg('')
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pendingFactorId,
        code: codigoMfa.trim(),
      })
      if (error) throw error
      setCodigoMfa('')
      setQrCodeSvg('')
      setMfaMsg('✅ MFA activado correctamente')
      await cargarMFA()
    } catch (e: unknown) {
      setMfaMsg(`❌ ${e instanceof Error ? e.message : 'Código inválido'}`)
    } finally {
      setMfaLoading(false)
    }
  }

  async function desactivarMFA() {
    if (!verifiedFactorId) return
    if (!confirm('¿Desactivar MFA para esta cuenta?')) return
    setMfaLoading(true)
    setMfaMsg('')
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactorId })
      if (error) throw error
      setMfaMsg('✅ MFA desactivado')
      await cargarMFA()
    } catch (e: unknown) {
      setMfaMsg(`❌ ${e instanceof Error ? e.message : 'No se pudo desactivar MFA'}`)
    } finally {
      setMfaLoading(false)
    }
  }

  async function exportarDatos() {
    window.open('/api/perfil/datos/export', '_blank')
  }

  async function registrarConsentimiento() {
    setPrivacyLoading(true)
    setPrivacyMsg('')
    try {
      const res = await fetch('/api/perfil/consentimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: privacyVersion || undefined }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo registrar la aceptación')
      setUltimoConsentimiento(data?.aceptado_en ?? new Date().toISOString())
      setPrivacyVersion(typeof data?.version === 'string' ? data.version : privacyVersion)
      setPrivacyMsg('✅ Aceptación de privacidad registrada')
      setTimeout(() => setPrivacyMsg(''), 3000)
    } catch (e: unknown) {
      setPrivacyMsg(`❌ ${e instanceof Error ? e.message : 'No se pudo registrar la aceptación'}`)
    } finally {
      setPrivacyLoading(false)
    }
  }

  const rolNombre = getRoleLabelFromId(usuario.rol_id)

  return (
    <div className="grid gap-6 max-w-2xl">

      {/* Info del usuario */}
      <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white text-2xl font-bold shadow">
          {(nombre ?? '?').charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-gray-900 text-lg">{nombre}</p>
          <p className="text-sm text-gray-500">{usuario.email}</p>
          <span className="inline-block mt-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {rolNombre}
          </span>
        </div>
      </div>

      {/* Datos personales */}
      <div className={cn(cardCls, 'p-5')}>
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
      <div className={cn(cardCls, 'p-5')}>
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

      {/* MFA */}
      <div className={cn(cardCls, 'p-5')}>
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-gray-400" />
          <h2 className="font-semibold text-gray-800">Autenticación de dos factores (MFA)</h2>
        </div>

        <p className="text-sm text-gray-500">
          Estado actual: <strong className={aal === 'aal2' ? 'text-green-600' : 'text-amber-600'}>{aal}</strong>
        </p>

        {verifiedFactorId ? (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            MFA activo en esta cuenta.
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            MFA no está activo. Recomendado para admins y contadores.
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {!verifiedFactorId && (
            <Button type="button" variant="outline" onClick={activarMFA} disabled={mfaLoading}>
              <Smartphone className="mr-1 h-4 w-4" /> {mfaLoading ? 'Generando...' : 'Activar MFA'}
            </Button>
          )}
          {verifiedFactorId && (
            <Button type="button" variant="outline" onClick={desactivarMFA} disabled={mfaLoading}>
              Desactivar MFA
            </Button>
          )}
        </div>

        {qrCodeSvg && pendingFactorId && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">1) Escanea el QR en tu app autenticadora</p>
            <div className="w-fit rounded bg-white p-2" dangerouslySetInnerHTML={{ __html: qrCodeSvg }} />
            <form onSubmit={verificarMFA} className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">2) Código de 6 dígitos</label>
                <input
                  value={codigoMfa}
                  onChange={(e) => setCodigoMfa(e.target.value)}
                  maxLength={6}
                  inputMode="numeric"
                  className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123456"
                  required
                />
              </div>
              <Button type="submit" disabled={mfaLoading || codigoMfa.trim().length < 6}>
                Verificar y activar
              </Button>
            </form>
          </div>
        )}

        {mfaMsg && (
          <p className={`mt-3 text-sm ${mfaMsg.startsWith('✅') ? 'text-green-600' : mfaMsg.startsWith('❌') ? 'text-red-500' : 'text-gray-600'}`}>
            {mfaMsg}
          </p>
        )}
      </div>

      <div className={cn(cardCls, 'p-5')}>
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-gray-400" />
          <h2 className="font-semibold text-gray-800">Privacidad y datos personales</h2>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Versión política de datos</label>
            <input
              value={privacyVersion}
              onChange={(e) => setPrivacyVersion(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="v1.0"
            />
            {ultimoConsentimiento && (
              <p className="mt-1 text-xs text-gray-400">
                Última aceptación registrada: {new Date(ultimoConsentimiento).toLocaleString('es-CO')}
              </p>
            )}
          </div>
          {privacyMsg && (
            <p className={`text-sm ${privacyMsg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
              {privacyMsg}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={exportarDatos}>
              Exportar mis datos
            </Button>
            <Button type="button" onClick={registrarConsentimiento} disabled={privacyLoading}>
              {privacyLoading ? 'Registrando...' : 'Registrar aceptación de privacidad'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
