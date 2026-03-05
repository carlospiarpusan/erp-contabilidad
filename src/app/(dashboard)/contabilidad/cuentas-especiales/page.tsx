export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Link2 } from 'lucide-react'
import { FormCuentasEspeciales } from '@/components/contabilidad/FormCuentasEspeciales'

const TIPOS: { tipo: string; label: string; desc: string }[] = [
  { tipo: 'caja',         label: 'Caja',            desc: 'Cuenta de caja para pagos en efectivo' },
  { tipo: 'banco',        label: 'Banco',            desc: 'Cuenta bancaria principal' },
  { tipo: 'clientes',     label: 'Clientes',         desc: 'Cartera y cuentas por cobrar' },
  { tipo: 'proveedores',  label: 'Proveedores',      desc: 'Cuentas por pagar a proveedores' },
  { tipo: 'acreedores',   label: 'Acreedores',       desc: 'Costos y gastos por pagar' },
  { tipo: 'inventario',   label: 'Inventario',       desc: 'Mercancías en bodega' },
  { tipo: 'ingresos',     label: 'Ingresos',         desc: 'Ventas operacionales' },
  { tipo: 'costo_ventas', label: 'Costo de ventas',  desc: 'Costo de la mercancía vendida' },
  { tipo: 'iva_ventas',   label: 'IVA Ventas',       desc: 'IVA generado en ventas' },
  { tipo: 'iva_compras',  label: 'IVA Compras',      desc: 'IVA descontable en compras' },
]

export default async function CuentasEspecialesPage() {
  const supabase = await createClient()

  const [{ data: especiales }, { data: cuentas }] = await Promise.all([
    supabase.from('cuentas_especiales').select('id, tipo, cuenta_id, cuentas_puc(id, codigo, descripcion)'),
    supabase.from('cuentas_puc').select('id, codigo, descripcion, nivel').eq('nivel', 4).order('codigo'),
  ])

  // Mapear tipo → cuenta actual
  const mapaActual = Object.fromEntries(
    (especiales ?? []).map(e => [e.tipo, e])
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
          <Link2 className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cuentas Especiales</h1>
          <p className="text-sm text-gray-500">Vincula cada función contable con su cuenta PUC</p>
        </div>
      </div>

      <FormCuentasEspeciales
        tipos={TIPOS}
        mapaActual={mapaActual}
        cuentas={cuentas ?? []}
      />
    </div>
  )
}
