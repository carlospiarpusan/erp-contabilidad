export const dynamic = 'force-dynamic'

import { PantallaPOS } from '@/components/pos/PantallaPOS'
import { getBodegas } from '@/lib/db/productos'
import { getFormasPago } from '@/lib/db/maestros'

export default async function POSPage() {
  const [bodegas, formasPago] = await Promise.all([
    getBodegas(),
    getFormasPago(),
  ])

  return (
    <PantallaPOS
      bodegas={bodegas}
      formasPago={formasPago}
    />
  )
}
