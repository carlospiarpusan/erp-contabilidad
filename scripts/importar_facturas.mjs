import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const log  = (...a) => console.log('[facturas]', ...a)
const warn = (...a) => console.warn('[warn]', ...a)

const EID = '948ce6fc-6337-4f39-9e80-7b2c0ce0166c'

async function main() {
  const facturas = JSON.parse(readFileSync('/tmp/facturas.json', 'utf-8'))
  log(`${facturas.length} facturas a importar`)

  // Obtener recursos de la empresa
  const { data: serie }    = await admin.from('consecutivos').select('id').eq('empresa_id', EID).eq('tipo', 'factura_venta').limit(1).single()
  const { data: bodega }   = await admin.from('bodegas').select('id').eq('empresa_id', EID).limit(1).single()
  const { data: ejercicios } = await admin.from('ejercicios').select('id, año').eq('empresa_id', EID)
  const { data: formaPago } = await admin.from('formas_pago').select('id').eq('empresa_id', EID).eq('descripcion', 'Efectivo').limit(1).single()

  const ejercicioMap = Object.fromEntries((ejercicios ?? []).map(e => [e.año, e.id]))

  // Crear o buscar cliente "CONSUMIDOR FINAL"
  let { data: cf } = await admin.from('clientes').select('id').eq('empresa_id', EID).ilike('razon_social', '%CONSUMIDOR FINAL%').limit(1).single()
  if (!cf) {
    const { data: nuevo } = await admin.from('clientes').insert({
      empresa_id:   EID,
      razon_social: 'CONSUMIDOR FINAL',
      tipo_documento: 'CC',
      numero_documento: '222222222',
      activo: true,
    }).select('id').single()
    cf = nuevo
    log('Cliente CONSUMIDOR FINAL creado:', cf?.id)
  } else {
    log('Cliente CONSUMIDOR FINAL existente:', cf.id)
  }

  // Importar facturas en chunks
  const docs = facturas.map(f => {
    const anio = parseInt(f.fecha?.split('-')[0] ?? '2025')
    return {
      empresa_id:       EID,
      tipo:             'factura_venta',
      numero:           f.numero,
      prefijo:          'F',
      serie_id:         serie?.id ?? null,
      cliente_id:       cf.id,
      bodega_id:        bodega?.id ?? null,
      ejercicio_id:     ejercicioMap[anio] ?? ejercicioMap[2025] ?? null,
      forma_pago_id:    formaPago?.id ?? null,
      fecha:            f.fecha || '2025-01-01',
      fecha_vencimiento: f.vence || null,
      total:            f.total,
      subtotal:         f.total,
      total_iva:        0,
      total_descuento:  0,
      total_costo:      0,
      estado:           f.estado,
      observaciones:    'Importado desde Coin In ERP',
    }
  })

  let total = 0
  for (let i = 0; i < docs.length; i += 100) {
    const chunk = docs.slice(i, i + 100)
    const { data, error } = await admin.from('documentos').insert(chunk).select('id')
    if (error) { warn(`chunk ${i}: ${error.message}`); continue }
    total += data.length
    log(`Chunk ${i}: ${data.length} insertadas (total: ${total})`)
  }

  log(`\n✓ Total facturas importadas: ${total}`)
}

main().catch(console.error)
