import { createClient } from '@/lib/supabase/server'
import { assertDocumentoCancelable, type DocumentoCancelableTipo } from '@/lib/accounting/cancelaciones'

export async function assertDocumentoCancelacionPermitida(id: string, tipo: DocumentoCancelableTipo) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documentos')
    .select(`
      id,
      estado,
      recibos(id),
      asientos(id),
      stock_movimientos(id)
    `)
    .eq('id', id)
    .eq('tipo', tipo)
    .single()

  if (error || !data) throw error ?? new Error('Documento no encontrado')

  assertDocumentoCancelable({
    tipo,
    estado: data.estado,
    recibosCount: Array.isArray(data.recibos) ? data.recibos.length : 0,
    asientosCount: Array.isArray(data.asientos) ? data.asientos.length : 0,
    stockMovimientosCount: Array.isArray(data.stock_movimientos) ? data.stock_movimientos.length : 0,
  })

  return data
}
