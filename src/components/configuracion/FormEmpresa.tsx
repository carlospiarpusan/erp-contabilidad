'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface Empresa {
  id: string
  nombre: string
  nit: string
  dv?: string | null
  razon_social?: string | null
  direccion?: string | null
  ciudad?: string | null
  departamento?: string | null
  pais?: string | null
  telefono?: string | null
  email?: string | null
  regimen?: string | null
  tipo_org?: string | null
}

interface Props { empresa: Empresa | null }

const REGIMENES = ['Responsable de IVA', 'No Responsable de IVA', 'Gran Contribuyente', 'Autorretenedor']
const TIPOS_ORG = ['Persona Natural', 'Persona Jurídica']

export function FormEmpresa({ empresa }: Props) {
  const [form, setForm] = useState<Omit<Empresa, 'id'>>({
    nombre:      empresa?.nombre      ?? '',
    nit:         empresa?.nit         ?? '',
    dv:          empresa?.dv          ?? '',
    razon_social: empresa?.razon_social ?? '',
    direccion:   empresa?.direccion   ?? '',
    ciudad:      empresa?.ciudad      ?? '',
    departamento: empresa?.departamento ?? '',
    pais:        empresa?.pais        ?? 'Colombia',
    telefono:    empresa?.telefono    ?? '',
    email:       empresa?.email       ?? '',
    regimen:     empresa?.regimen     ?? '',
    tipo_org:    empresa?.tipo_org    ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setMsg(null)
    try {
      const res = await fetch('/api/configuracion/empresa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error al guardar')
      setMsg({ tipo: 'ok', texto: 'Datos de la empresa actualizados.' })
    } catch (e: unknown) {
      setMsg({ tipo: 'err', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  const field = (label: string, key: keyof typeof form, opts?: { type?: string; placeholder?: string }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input
        type={opts?.type ?? 'text'}
        value={(form[key] as string) ?? ''}
        onChange={e => set(key, e.target.value)}
        placeholder={opts?.placeholder}
        className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.texto}
        </div>
      )}

      {/* Identificación */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Identificación</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('Nombre comercial *', 'nombre', { placeholder: 'Nombre que aparece en documentos' })}
          {field('Razón social', 'razon_social', { placeholder: 'Razón social legal' })}
          <div className="flex gap-2">
            <div className="flex-1">{field('NIT *', 'nit', { placeholder: '123456789' })}</div>
            <div className="w-20">{field('DV', 'dv', { placeholder: '0' })}</div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Régimen</label>
            <select
              value={form.regimen ?? ''}
              onChange={e => set('regimen', e.target.value)}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Seleccionar —</option>
              {REGIMENES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Tipo de organización</label>
            <select
              value={form.tipo_org ?? ''}
              onChange={e => set('tipo_org', e.target.value)}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Seleccionar —</option>
              {TIPOS_ORG.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Contacto y ubicación */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Contacto y Ubicación</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('Dirección', 'direccion', { placeholder: 'Calle 123 # 45-67' })}
          {field('Ciudad', 'ciudad', { placeholder: 'Ipiales' })}
          {field('Departamento', 'departamento', { placeholder: 'Nariño' })}
          {field('País', 'pais', { placeholder: 'Colombia' })}
          {field('Teléfono', 'telefono', { type: 'tel', placeholder: '+57 300 000 0000' })}
          {field('Email', 'email', { type: 'email', placeholder: 'empresa@correo.com' })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}
