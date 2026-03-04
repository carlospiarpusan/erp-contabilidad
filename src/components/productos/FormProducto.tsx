'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'
import type { Producto, Familia, Fabricante, Impuesto } from '@/types'
import { formatCOP } from '@/utils/cn'

const varianteSchema = z.object({
  talla:         z.string().optional(),
  color:         z.string().optional(),
  codigo_barras: z.string().optional(),
  precio_venta:  z.coerce.number().optional(),
  precio_compra: z.coerce.number().optional(),
})

const schema = z.object({
  codigo:           z.string().min(1, 'Requerido'),
  codigo_barras:    z.string().optional(),
  descripcion:      z.string().min(2, 'Requerido'),
  descripcion_larga: z.string().optional(),
  precio_venta:     z.coerce.number().min(0),
  precio_compra:    z.coerce.number().min(0),
  precio_venta2:    z.coerce.number().optional(),
  familia_id:       z.string().optional(),
  fabricante_id:    z.string().optional(),
  impuesto_id:      z.string().optional(),
  unidad_medida:    z.string(),
  tiene_variantes:  z.boolean(),
  tiene_vencimiento: z.boolean(),
  variantes: z.array(varianteSchema).optional(),
})

type FormData = z.infer<typeof schema>

interface FormProductoProps {
  inicial?: Partial<Producto>
  familias: Familia[]
  fabricantes: Fabricante[]
  impuestos: Impuesto[]
  onGuardar: (datos: FormData) => Promise<void>
  onCancelar: () => void
  cargando?: boolean
}

const TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '32', '34', '36', '38', '40', '42', '44']
const COLORES = ['Negro', 'Beige', 'Blanco', 'Rojo', 'Azul', 'Rosado', 'Gris', 'Café']

export function FormProducto({ inicial, familias, fabricantes, impuestos, onGuardar, onCancelar, cargando }: FormProductoProps) {
  const { register, handleSubmit, watch, control, formState: { errors } } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      codigo:            inicial?.codigo ?? '',
      codigo_barras:     inicial?.codigo_barras ?? '',
      descripcion:       inicial?.descripcion ?? '',
      descripcion_larga: inicial?.descripcion_larga ?? '',
      precio_venta:      inicial?.precio_venta ?? 0,
      precio_compra:     inicial?.precio_compra ?? 0,
      precio_venta2:     inicial?.precio_venta2 ?? undefined,
      familia_id:        inicial?.familia_id ?? '',
      fabricante_id:     inicial?.fabricante_id ?? '',
      impuesto_id:       inicial?.impuesto_id ?? '',
      unidad_medida:     'UND',
      tiene_variantes:   inicial?.tiene_variantes ?? false,
      tiene_vencimiento: inicial?.tiene_vencimiento ?? false,
      variantes:         [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'variantes' })

  const tieneVariantes = watch('tiene_variantes')
  const precioVenta    = watch('precio_venta')
  const precioCompra   = watch('precio_compra')
  const ganancia       = (Number(precioVenta) - Number(precioCompra))
  const margen         = precioVenta > 0 ? ((ganancia / Number(precioVenta)) * 100).toFixed(1) : '0'

  return (
    <form onSubmit={handleSubmit(onGuardar)} className="flex flex-col gap-4">
      {/* Información básica */}
      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Información del Producto
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <Input
            label="Código *"
            {...register('codigo')}
            error={errors.codigo?.message}
            placeholder="FAJ-001"
          />
          <Input
            label="Código de barras"
            {...register('codigo_barras')}
            placeholder="7700000000000"
          />
          <div className="col-span-2">
            <Input
              label="Descripción *"
              {...register('descripcion')}
              error={errors.descripcion?.message}
              placeholder="Faja Reductora Talla M Color Negro"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Familia / Categoría</label>
            <select
              {...register('familia_id')}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin categoría</option>
              {familias.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Fabricante / Marca</label>
            <select
              {...register('fabricante_id')}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin marca</option>
              {fabricantes.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">IVA</label>
            <select
              {...register('impuesto_id')}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin IVA</option>
              {impuestos.map(i => (
                <option key={i.id} value={i.id}>{i.descripcion} ({i.porcentaje}%)</option>
              ))}
            </select>
          </div>
          <Input label="Unidad de medida" {...register('unidad_medida')} placeholder="UND" />
        </div>
      </fieldset>

      {/* Precios */}
      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Precios
        </legend>
        <div className="mt-2 grid grid-cols-3 gap-4">
          <Input
            label="Precio de Venta *"
            type="number"
            {...register('precio_venta', { valueAsNumber: true })}
            error={errors.precio_venta?.message}
            placeholder="0"
          />
          <Input
            label="Precio de Compra *"
            type="number"
            {...register('precio_compra', { valueAsNumber: true })}
            error={errors.precio_compra?.message}
            placeholder="0"
          />
          <Input
            label="Precio mayorista"
            type="number"
            {...register('precio_venta2', { valueAsNumber: true })}
            placeholder="0"
          />
        </div>
        {/* Indicador de margen */}
        {Number(precioVenta) > 0 && (
          <div className="mt-3 flex gap-6 rounded-lg bg-blue-50 px-4 py-2 text-sm">
            <span>Ganancia: <strong className="text-green-700">{formatCOP(ganancia)}</strong></span>
            <span>Margen: <strong className="text-blue-700">{margen}%</strong></span>
          </div>
        )}
      </fieldset>

      {/* Opciones */}
      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Opciones
        </legend>
        <div className="mt-2 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" {...register('tiene_variantes')} className="h-4 w-4 rounded border-gray-300 accent-blue-600" />
            Tiene variantes (talla / color)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" {...register('tiene_vencimiento')} className="h-4 w-4 rounded border-gray-300 accent-blue-600" />
            Controlar fecha de vencimiento
          </label>
        </div>
      </fieldset>

      {/* Variantes (talla × color) */}
      {tieneVariantes && (
        <fieldset className="rounded-lg border border-blue-200 bg-blue-50/30 p-4">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
            Variantes de Producto
          </legend>
          <div className="mt-3 flex flex-col gap-3">
            {fields.map((field, idx) => (
              <div key={field.id} className="grid grid-cols-5 gap-2 items-end rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Talla</label>
                  <select
                    {...register(`variantes.${idx}.talla`)}
                    className="h-8 rounded border border-gray-300 bg-white px-2 text-sm"
                  >
                    <option value="">Talla</option>
                    {TALLAS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Color</label>
                  <select
                    {...register(`variantes.${idx}.color`)}
                    className="h-8 rounded border border-gray-300 bg-white px-2 text-sm"
                  >
                    <option value="">Color</option>
                    {COLORES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <Input
                  label="Precio venta"
                  type="number"
                  {...register(`variantes.${idx}.precio_venta`, { valueAsNumber: true })}
                  placeholder="Igual al base"
                />
                <Input
                  label="Cód. barras"
                  {...register(`variantes.${idx}.codigo_barras`)}
                  placeholder="Opcional"
                />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="mb-0.5 rounded p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ talla: '', color: '', precio_venta: undefined })}
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar variante
            </Button>
          </div>
        </fieldset>
      )}

      {/* Acciones */}
      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
        <Button type="button" variant="outline" onClick={onCancelar} disabled={cargando}>
          Cancelar
        </Button>
        <Button type="submit" variant="success" disabled={cargando}>
          {cargando ? 'Guardando...' : inicial?.id ? 'Actualizar producto' : 'Crear producto'}
        </Button>
      </div>
    </form>
  )
}
