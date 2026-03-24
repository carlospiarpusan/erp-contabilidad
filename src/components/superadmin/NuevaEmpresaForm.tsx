'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type EmpresaEditable = {
  id?: string
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
  activa?: boolean
}

type Props = {
  empresa?: EmpresaEditable | null
}

const REGIMENES = ['Responsable de IVA', 'No Responsable de IVA', 'Gran Contribuyente', 'Autorretenedor']
const TIPOS_ORG = ['Persona Natural', 'Persona Jurídica']

export function NuevaEmpresaForm({ empresa = null }: Props) {
  const router = useRouter()
  const isEditing = Boolean(empresa?.id)
  const [form, setForm] = useState({
    nombre: empresa?.nombre ?? '',
    nit: empresa?.nit ?? '',
    dv: empresa?.dv ?? '',
    razon_social: empresa?.razon_social ?? '',
    direccion: empresa?.direccion ?? '',
    ciudad: empresa?.ciudad ?? '',
    departamento: empresa?.departamento ?? '',
    pais: empresa?.pais ?? 'Colombia',
    telefono: empresa?.telefono ?? '',
    email: empresa?.email ?? '',
    regimen: empresa?.regimen ?? '',
    tipo_org: empresa?.tipo_org ?? '',
    activa: empresa?.activa ?? true,
    email_admin: '',
    nombre_admin: '',
    password_admin: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    setOk(null)

    try {
      const endpoint = isEditing ? `/api/superadmin/empresas/${empresa?.id}` : '/api/superadmin/empresas'
      const method = isEditing ? 'PATCH' : 'POST'
      const payload = {
        nombre: form.nombre,
        nit: form.nit,
        dv: form.dv || null,
        razon_social: form.razon_social || null,
        direccion: form.direccion || null,
        ciudad: form.ciudad || null,
        departamento: form.departamento || null,
        pais: form.pais || null,
        telefono: form.telefono || null,
        email: form.email || null,
        regimen: form.regimen || null,
        tipo_org: form.tipo_org || null,
        activa: form.activa,
        email_admin: form.email_admin || null,
        nombre_admin: form.nombre_admin || null,
        password_admin: form.password_admin || null,
      }

      if (!isEditing && (!form.email_admin || !form.nombre_admin || !form.password_admin)) {
        throw new Error('Completa los datos del administrador inicial')
      }

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No fue posible guardar')

      if (isEditing) {
        setOk('Datos de la escuela / empresa actualizados.')
      } else {
        setForm({
          nombre: '',
          nit: '',
          dv: '',
          razon_social: '',
          direccion: '',
          ciudad: '',
          departamento: '',
          pais: 'Colombia',
          telefono: '',
          email: '',
          regimen: '',
          tipo_org: '',
          activa: true,
          email_admin: '',
          nombre_admin: '',
          password_admin: '',
        })
        setOk('Escuela / empresa creada correctamente.')
      }

      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  function field(label: string, key: keyof typeof form, options?: { type?: string; placeholder?: string; required?: boolean }) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        <input
          type={options?.type ?? 'text'}
          value={typeof form[key] === 'boolean' ? '' : String(form[key] ?? '')}
          onChange={set(key)}
          placeholder={options?.placeholder}
          required={options?.required}
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {(error || ok) && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {error ?? ok}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field('Nombre comercial *', 'nombre', { required: true, placeholder: 'ClovEnt School' })}
        {field('Razón social', 'razon_social', { placeholder: 'Institución Educativa ClovEnt SAS' })}
        <div className="flex gap-2">
          <div className="flex-1">{field('NIT *', 'nit', { required: true, placeholder: '900123456' })}</div>
          <div className="w-20">{field('DV', 'dv', { placeholder: '1' })}</div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Tipo de organización</label>
          <select
            value={form.tipo_org}
            onChange={set('tipo_org')}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">— Seleccionar —</option>
            {TIPOS_ORG.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Régimen</label>
          <select
            value={form.regimen}
            onChange={set('regimen')}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">— Seleccionar —</option>
            {REGIMENES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        {field('Email institucional', 'email', { type: 'email', placeholder: 'rectoria@escuela.com' })}
        {field('Teléfono', 'telefono', { type: 'tel', placeholder: '+57 300 000 0000' })}
        {field('Dirección', 'direccion', { placeholder: 'Calle 12 # 5-10' })}
        {field('Ciudad', 'ciudad', { placeholder: 'Pasto' })}
        {field('Departamento', 'departamento', { placeholder: 'Nariño' })}
        {field('País', 'pais', { placeholder: 'Colombia' })}
      </div>

      {!isEditing && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-violet-900">Administrador inicial</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field('Nombre administrador *', 'nombre_admin', { required: true, placeholder: 'Rector o administrador' })}
            {field('Email administrador *', 'email_admin', { type: 'email', required: true, placeholder: 'admin@escuela.com' })}
            <div className="sm:col-span-2">
              {field('Contraseña inicial *', 'password_admin', { type: 'password', required: true, placeholder: 'Mínimo 6 caracteres' })}
            </div>
          </div>
        </div>
      )}

      {isEditing && (
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.activa}
            onChange={set('activa')}
            className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
          />
          Escuela / empresa activa
        </label>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {guardando ? (isEditing ? 'Guardando…' : 'Creando…') : (isEditing ? 'Guardar cambios' : 'Registrar escuela / empresa')}
        </button>
      </div>
    </form>
  )
}
