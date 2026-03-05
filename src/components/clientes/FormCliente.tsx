'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'
import type { Cliente, GrupoCliente } from '@/types'

const schema = z.object({
  razon_social: z.string().min(2, 'La razón social o nombre completo es obligatorio'),
  nombre_contacto: z.string().optional(),
  tipo_documento: z.string().min(1, 'Seleccione el tipo de documento'),
  numero_documento: z.string().min(3, 'El número de documento es obligatorio (mín. 3 caracteres)'),
  dv: z.string().optional(),
  responsabilidad_fiscal: z.string().min(1, 'Seleccione la responsabilidad fiscal'),
  aplica_retencion: z.boolean(),
  grupo_id: z.string().optional().nullable(),
  email: z.string().email('Ingrese un correo electrónico válido').optional().or(z.literal('')),
  telefono: z.string().optional(),
  whatsapp: z.string().optional(),
  direccion: z.string().optional(),
  ciudad: z.string().min(1, 'La ciudad es obligatoria'),
  departamento: z.string().min(1, 'El departamento es obligatorio'),
  observaciones: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const tiposDocumento = [
  { value: 'NIT', label: 'NIT' },
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'Pasaporte', label: 'Pasaporte' },
  { value: 'PEP', label: 'PEP' },
]

const responsabilidades = [
  { value: 'R-99-PN', label: 'No responsable de IVA' },
  { value: 'O-13', label: 'Gran contribuyente' },
  { value: 'O-15', label: 'Autorretenedor' },
  { value: 'O-23', label: 'Régimen simple' },
  { value: 'O-47', label: 'Régimen ordinario' },
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
      razon_social: inicial?.razon_social ?? '',
      nombre_contacto: inicial?.nombre_contacto ?? '',
      tipo_documento: inicial?.tipo_documento ?? 'NIT',
      numero_documento: inicial?.numero_documento ?? '',
      dv: inicial?.dv ?? '',
      responsabilidad_fiscal: inicial?.responsabilidad_fiscal ?? 'R-99-PN',
      aplica_retencion: inicial?.aplica_retencion ?? false,
      grupo_id: inicial?.grupo_id ?? '',
      email: inicial?.email ?? '',
      telefono: inicial?.telefono ?? '',
      whatsapp: inicial?.whatsapp ?? '',
      direccion: inicial?.direccion ?? '',
      ciudad: inicial?.ciudad ?? 'Ipiales',
      departamento: inicial?.departamento ?? 'Nariño',
      observaciones: inicial?.observaciones ?? '',
    },
  })

  // Limpiamos los datos antes de enviar para asegurar que los UUIDs vacíos sean null
  const onSubmit = (datos: FormData) => {
    const cleaned = { ...datos }
    if (cleaned.grupo_id === '') cleaned.grupo_id = null
    onGuardar(cleaned)
  }

  const hasErrors = Object.keys(errors).length > 0

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 overflow-y-auto px-1">
      {hasErrors && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4" />
          <span>Por favor corrija los campos marcados como obligatorios.</span>
        </div>
      )}

      {/* Datos de identificación */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">
          1. Identificación del Cliente
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Razón Social o Nombre Completo *"
              {...register('razon_social')}
              error={errors.razon_social?.message}
              placeholder="Ej: Juan Pérez o Inversiones ABC S.A.S"
              required
            />
          </div>
          <Select
            label="Tipo de documento *"
            {...register('tipo_documento')}
            error={errors.tipo_documento?.message}
            options={tiposDocumento}
            required
          />
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                label="Número de documento *"
                {...register('numero_documento')}
                error={errors.numero_documento?.message}
                placeholder="1085123456"
                required
              />
            </div>
            <div className="w-16">
              <Input
                label="DV"
                {...register('dv')}
                placeholder="0"
                maxLength={1}
              />
            </div>
          </div>
          <Input
            label="Persona de contacto"
            {...register('nombre_contacto')}
            placeholder="Nombre de quién atiende"
          />
          <Select
            label="Responsabilidad fiscal *"
            {...register('responsabilidad_fiscal')}
            error={errors.responsabilidad_fiscal?.message}
            options={responsabilidades}
            required
          />
        </div>
      </section>

      {/* Ubicación y Grupo */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">
          2. Ubicación y Clasificación
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Departamento *"
            {...register('departamento')}
            error={errors.departamento?.message}
            required
          />
          <Input
            label="Ciudad *"
            {...register('ciudad')}
            error={errors.ciudad?.message}
            required
          />
          <div className="sm:col-span-2">
            <Input label="Dirección exacta" {...register('direccion')} placeholder="Calle 20 # 5-10 Barrio Centro" />
          </div>
          <Select
            label="Grupo de cliente"
            {...register('grupo_id')}
            error={errors.grupo_id?.message}
            options={grupos.map(g => ({ value: g.id, label: g.nombre }))}
          />
          <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
            <input
              type="checkbox"
              id="retencion"
              {...register('aplica_retencion')}
              className="h-5 w-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="retencion" className="text-sm font-medium text-blue-900 leading-none cursor-pointer">
              ¿A este cliente se le debe aplicar retención en la fuente?
            </label>
          </div>
        </div>
      </section>

      {/* Canales de contacto */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">
          3. Canales de Comunicación
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Email"
            type="email"
            {...register('email')}
            error={errors.email?.message}
            placeholder="correo@ejemplo.com"
          />
          <Input label="Teléfono" {...register('telefono')} placeholder="310..." />
          <Input label="WhatsApp" {...register('whatsapp')} placeholder="310..." />
        </div>
        <Input
          label="Observaciones adicionales"
          {...register('observaciones')}
          placeholder="Ej: Horarios de entrega, condiciones especiales, etc."
        />
      </section>

      {/* Botones de acción */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-900 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 mt-4">
        <Button type="button" variant="outline" onClick={onCancelar} disabled={cargando}>
          Cancelar
        </Button>
        <Button type="submit" variant="success" disabled={cargando} className="min-w-[140px]">
          {cargando ? 'Guardando...' : inicial?.id ? 'Actualizar Cliente' : 'Guardar Cliente'}
        </Button>
      </div>
    </form>
  )
}
