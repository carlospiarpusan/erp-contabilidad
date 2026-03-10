'use client'

import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'
import type { Producto, Familia, Fabricante, Impuesto, Bodega } from '@/types'
import { formatCOP } from '@/utils/cn'

const varianteSchema = z.object({
  talla: z.string().optional(),
  color: z.string().optional(),
  codigo_barras: z.string().optional(),
  precio_venta: z.coerce.number().optional(),
  precio_compra: z.coerce.number().optional(),
})

const schema = z.object({
  codigo: z.string().min(1, 'Requerido'),
  codigo_barras: z.string().optional(),
  descripcion: z.string().min(2, 'Requerido'),
  descripcion_larga: z.string().optional(),
  precio_venta: z.coerce.number().min(0),
  precio_compra: z.coerce.number().min(0),
  precio_venta2: z.coerce.number().optional(),
  familia_id: z.string().optional(),
  fabricante_id: z.string().optional(),
  impuesto_id: z.string().optional(),
  unidad_medida: z.string(),
  activo: z.boolean(),
  tiene_variantes: z.boolean(),
  tiene_vencimiento: z.boolean(),
  inventario_inicial: z.coerce.number().min(0, 'No puede ser negativo').default(0),
  bodega_inicial_id: z.string().optional(),
  variantes: z.array(varianteSchema).optional(),
}).superRefine((data, ctx) => {
  if (Number(data.inventario_inicial ?? 0) > 0 && !data.bodega_inicial_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['bodega_inicial_id'],
      message: 'Selecciona la bodega del inventario inicial',
    })
  }
})

type FormData = z.infer<typeof schema>

interface FormProductoProps {
  inicial?: Partial<Producto>
  familias: Familia[]
  fabricantes: Fabricante[]
  impuestos: Impuesto[]
  bodegas?: Bodega[]
  canSetInitialStock?: boolean
  onGuardar: (datos: FormData) => Promise<void>
  onCancelar: () => void
  cargando?: boolean
}

const TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '32', '34', '36', '38', '40', '42', '44']
const COLORES = ['Negro', 'Beige', 'Blanco', 'Rojo', 'Azul', 'Rosado', 'Gris', 'Café']

export function FormProducto({
  inicial,
  familias,
  fabricantes,
  impuestos,
  bodegas = [],
  canSetInitialStock = false,
  onGuardar,
  onCancelar,
  cargando,
}: FormProductoProps) {
  const bodegaInicialDefault = bodegas.find((bodega) => bodega.principal)?.id ?? bodegas[0]?.id ?? ''

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({

    resolver: zodResolver(schema) as any,
    defaultValues: {
      codigo: inicial?.codigo ?? '',
      codigo_barras: inicial?.codigo_barras ?? '',
      descripcion: inicial?.descripcion ?? '',
      descripcion_larga: inicial?.descripcion_larga ?? '',
      precio_venta: inicial?.precio_venta ?? 0,
      precio_compra: inicial?.precio_compra ?? 0,
      precio_venta2: inicial?.precio_venta2 ?? undefined,
      familia_id: inicial?.familia_id ?? '',
      fabricante_id: inicial?.fabricante_id ?? '',
      impuesto_id: inicial?.impuesto_id ?? '',
      unidad_medida: inicial?.unidad_medida ?? 'UND',
      activo: inicial?.activo ?? true,
      tiene_variantes: inicial?.tiene_variantes ?? false,
      tiene_vencimiento: inicial?.tiene_vencimiento ?? false,
      inventario_inicial: 0,
      bodega_inicial_id: bodegaInicialDefault,
      variantes: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'variantes' })

  const tieneVariantes = useWatch({ control, name: 'tiene_variantes' })
  const precioVenta = useWatch({ control, name: 'precio_venta' })
  const precioCompra = useWatch({ control, name: 'precio_compra' })
  const inventarioInicial = useWatch({ control, name: 'inventario_inicial' })
  const ganancia = (Number(precioVenta) - Number(precioCompra))
  const margen = precioVenta > 0 ? ((ganancia / Number(precioVenta)) * 100).toFixed(1) : '0'
  const isCreateMode = !inicial?.id

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

      {isCreateMode && (
        <fieldset className="rounded-lg border border-gray-200 p-4">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Inventario Inicial
          </legend>
          {canSetInitialStock ? (
            <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Cantidad inicial"
                type="number"
                min="0"
                step="1"
                {...register('inventario_inicial', { valueAsNumber: true })}
                error={errors.inventario_inicial?.message}
                placeholder="0"
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Bodega inicial</label>
                <select
                  {...register('bodega_inicial_id')}
                  disabled={Number(inventarioInicial ?? 0) <= 0 || bodegas.length === 0}
                  className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                  <option value="">Selecciona una bodega</option>
                  {bodegas.map((bodega) => (
                    <option key={bodega.id} value={bodega.id}>
                      {bodega.nombre}{bodega.principal ? ' (Principal)' : ''}
                    </option>
                  ))}
                </select>
                {errors.bodega_inicial_id?.message && (
                  <p className="text-xs text-red-600">{errors.bodega_inicial_id.message}</p>
                )}
              </div>
              <p className="md:col-span-2 text-sm text-gray-500">
                Si no registras existencias o dejas la cantidad en `0`, el producto se crea con inventario en `0`.
              </p>
              {bodegas.length === 0 && (
                <p className="md:col-span-2 text-sm text-amber-700">
                  No hay bodegas configuradas. Si ingresas inventario inicial primero debes crear una bodega.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              El producto se creará con inventario en `0`. El inventario inicial solo lo puede registrar un usuario con permisos de inventario.
            </p>
          )}
        </fieldset>
      )}

      {/* Opciones */}
      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Opciones
        </legend>
        <div className="mt-2 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" {...register('activo')} className="h-4 w-4 rounded border-gray-300 accent-green-600" />
            Producto activo
          </label>
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
