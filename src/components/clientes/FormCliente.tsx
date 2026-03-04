'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Cliente, GrupoCliente } from '@/types'

const schema = z.object({
  razon_social:           z.string().min(2, 'Requerido'),
  nombre_contacto:        z.string().optional(),
  tipo_documento:         z.string(),
  numero_documento:       z.string().optional(),
  dv:                     z.string().optional(),
  responsabilidad_fiscal: z.string(),
  aplica_retencion:       z.boolean(),
  grupo_id:               z.string().optional(),
  email:                  z.string().email('Email inválido').optional().or(z.literal('')),
  telefono:               z.string().optional(),
  whatsapp:               z.string().optional(),
  direccion:              z.string().optional(),
  ciudad:                 z.string(),
  departamento:           z.string(),
  observaciones:          z.string().optional(),
})

type FormData = z.infer<typeof schema>

const tiposDocumento = ['NIT', 'CC', 'CE', 'Pasaporte', 'PEP']
const responsabilidades = [
  { valor: 'R-99-PN', label: 'No responsable de IVA' },
  { valor: 'O-13',    label: 'Gran contribuyente' },
  { valor: 'O-15',    label: 'Autorretenedor' },
  { valor: 'O-23',    label: 'Régimen simple' },
  { valor: 'O-47',    label: 'Régimen ordinario' },
]

interface FormClienteProps {
  inicial?: Partial<Cliente>
  grupos: GrupoCliente[]
  onGuardar: (datos: FormData) => Promise<void>
  onCancelar: () => void
  cargando?: boolean
}

export function FormCliente({ inicial, grupos, onGuardar, onCancelar, cargando }: FormClienteProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      razon_social:           inicial?.razon_social ?? '',
      nombre_contacto:        inicial?.nombre_contacto ?? '',
      tipo_documento:         inicial?.tipo_documento ?? 'NIT',
      numero_documento:       inicial?.numero_documento ?? '',
      dv:                     inicial?.dv ?? '',
      responsabilidad_fiscal: inicial?.responsabilidad_fiscal ?? 'R-99-PN',
      aplica_retencion:       inicial?.aplica_retencion ?? false,
      grupo_id:               inicial?.grupo_id ?? '',
      email:                  inicial?.email ?? '',
      telefono:               inicial?.telefono ?? '',
      whatsapp:               inicial?.whatsapp ?? '',
      direccion:              inicial?.direccion ?? '',
      ciudad:                 inicial?.ciudad ?? 'Ipiales',
      departamento:           inicial?.departamento ?? 'Nariño',
      observaciones:          inicial?.observaciones ?? '',
    },
  })

  return (
    <form onSubmit={handleSubmit(onGuardar)} className="flex flex-col gap-4">
      {/* Datos de identificación */}
      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Identificación
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input
              label="Razón Social / Nombre *"
              {...register('razon_social')}
              error={errors.razon_social?.message}
              placeholder="Ej: Maria Gómez o Comercializadora XYZ"
            />
          </div>
          <Input
            label="Persona de contacto"
            {...register('nombre_contacto')}
            placeholder="Nombre del contacto"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Tipo de documento</label>
            <select
              {...register('tipo_documento')}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {tiposDocumento.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Input
            label="Número de documento"
            {...register('numero_documento')}
            placeholder="123456789"
          />
          <Input
            label="DV (dígito verificación)"
            {...register('dv')}
            placeholder="0-9"
            maxLength={1}
          />
        </div>
      </fieldset>

      {/* Datos fiscales */}
      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Información Fiscal
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Responsabilidad fiscal</label>
            <select
              {...register('responsabilidad_fiscal')}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {responsabilidades.map(r => (
                <option key={r.valor} value={r.valor}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Grupo de cliente</label>
            <select
              {...register('grupo_id')}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin grupo</option>
              {grupos.map(g => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="retencion"
              {...register('aplica_retencion')}
              className="h-4 w-4 rounded border-gray-300 accent-blue-600"
            />
            <label htmlFor="retencion" className="text-sm text-gray-700">
              Aplica retención en la fuente
            </label>
          </div>
        </div>
      </fieldset>

      {/* Contacto */}
      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Contacto y Ubicación
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <Input
            label="Email"
            type="email"
            {...register('email')}
            error={errors.email?.message}
            placeholder="cliente@ejemplo.com"
          />
          <Input label="Teléfono" {...register('telefono')} placeholder="3001234567" />
          <Input label="WhatsApp" {...register('whatsapp')} placeholder="3001234567" />
          <Input label="Ciudad" {...register('ciudad')} placeholder="Ipiales" />
          <div className="col-span-2">
            <Input label="Dirección" {...register('direccion')} placeholder="Calle 10 # 5-20" />
          </div>
          <div className="col-span-2">
            <Input
              label="Observaciones"
              {...register('observaciones')}
              placeholder="Notas adicionales..."
            />
          </div>
        </div>
      </fieldset>

      {/* Acciones */}
      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
        <Button type="button" variant="outline" onClick={onCancelar} disabled={cargando}>
          Cancelar
        </Button>
        <Button type="submit" variant="success" disabled={cargando}>
          {cargando ? 'Guardando...' : inicial?.id ? 'Actualizar cliente' : 'Crear cliente'}
        </Button>
      </div>
    </form>
  )
}
