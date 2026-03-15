'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn, cardCls } from '@/utils/cn'

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
  plantilla_pdf?: string | null
}

interface Props { empresa: Empresa | null }

const REGIMENES = ['Responsable de IVA', 'No Responsable de IVA', 'Gran Contribuyente', 'Autorretenedor']
const TIPOS_ORG = ['Persona Natural', 'Persona Jurídica']
const PLANTILLAS = [
  { value: 'clasica',      label: 'Clásica',      desc: 'Bordes tradicionales, sello de empresa' },
  { value: 'moderna',      label: 'Moderna',      desc: 'Encabezado con color, tipografía limpia' },
  { value: 'minimalista',  label: 'Minimalista',  desc: 'Sin bordes, mucho espacio en blanco' },
  { value: 'compacta',     label: 'Compacta',     desc: 'Media carta, fuente pequeña, densa' },
]

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
    plantilla_pdf: empresa?.plantilla_pdf ?? 'clasica',
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
    } catch (e) {
      setMsg({ tipo: 'err', texto: e instanceof Error ? e.message : 'Error' })
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
      <div className={cn(cardCls, 'p-6')}>
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
      <div className={cn(cardCls, 'p-6')}>
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

      {/* Plantilla PDF */}
      <div className={cn(cardCls, 'p-6')}>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Plantilla de documentos PDF</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PLANTILLAS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => set('plantilla_pdf', p.value)}
              className={`flex flex-col items-start p-3 rounded-xl border-2 text-left transition-colors ${
                form.plantilla_pdf === p.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <span className={`text-sm font-semibold ${form.plantilla_pdf === p.value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                {p.label}
              </span>
              <span className="text-xs text-gray-500 mt-0.5">{p.desc}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">Se aplica a facturas, cotizaciones, remisiones y demás documentos imprimibles.</p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}
