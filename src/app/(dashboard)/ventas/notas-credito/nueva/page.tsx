export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { FormNotaCredito } from '@/components/ventas/FormNotaCredito'
import { RotateCcw } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ factura_id?: string }>
}

export default async function NuevaNotaCreditoPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const supabase = await createClient()

  // Si viene con factura_id precargado, obtener la factura
  let facturaInicial = null
  if (sp.factura_id) {
    const { data } = await supabase
      .from('documentos')
      .select(`
        id, numero, prefijo, fecha, total, subtotal, total_iva, cliente_id,
        cliente:cliente_id(razon_social),
        lineas:documentos_lineas(id, descripcion, cantidad, precio_unitario, subtotal, total_iva, total, descuento_porcentaje, producto:producto_id(codigo))
      `)
      .eq('id', sp.factura_id)
      .eq('tipo', 'factura_venta')
      .neq('estado', 'cancelada')
      .single()
    facturaInicial = data
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100">
          <RotateCcw className="h-5 w-5 text-rose-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nueva Nota Crédito</h1>
          <p className="text-sm text-gray-500">Registra una devolución total o parcial de una factura de venta</p>
        </div>
      </div>

      <FormNotaCredito facturaInicial={facturaInicial as any} />
    </div>
  )
}
