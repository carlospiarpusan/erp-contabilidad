export const dynamic = 'force-dynamic'

import { getClienteById, getGruposClientes } from '@/lib/db/clientes'
import { DetalleCliente } from '@/components/clientes/DetalleCliente'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClienteDetallePage({ params }: Props) {
  const { id } = await params

  const [cliente, grupos] = await Promise.all([
    getClienteById(id).catch(() => null),
    getGruposClientes(),
  ])

  if (!cliente) notFound()

  return <DetalleCliente cliente={cliente} grupos={grupos} />
}
