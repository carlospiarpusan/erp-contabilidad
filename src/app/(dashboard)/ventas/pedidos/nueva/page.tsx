export const dynamic = 'force-dynamic'

import { getClientes } from '@/lib/db/clientes'
import { getProductos, getImpuestos, getBodegas } from '@/lib/db/productos'
import { FormPedido } from '@/components/pedidos/FormPedido'
import { ClipboardList } from 'lucide-react'

export default async function NuevoPedidoPage() {
  const [{ clientes }, { productos }, impuestos, bodegas] = await Promise.all([
    getClientes({ activo: true, limit: 500 }),
    getProductos({ activo: true, limit: 500 }),
    getImpuestos(),
    getBodegas(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
          <ClipboardList className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nuevo Pedido</h1>
          <p className="text-sm text-gray-500">Orden de compra de cliente</p>
        </div>
      </div>

      <FormPedido
        clientes={clientes as any}
        productos={productos as any}
        impuestos={impuestos as any}
        bodegas={bodegas as any}
      />
    </div>
  )
}
