import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const EID = '948ce6fc-6337-4f39-9e80-7b2c0ce0166c'
const log  = (...a) => console.log('[stock]', ...a)
const warn = (...a) => console.warn('[warn]', ...a)

function parseCsv(raw, sep = ',') {
  const lines = raw.split(/\r?\n/).filter(l => l.trim())
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^\uFEFF/, ''))
  return lines.slice(1).map(line => {
    const vals = line.split(sep)
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]?.trim() ?? '']))
  })
}

async function main() {
  // Obtener bodega
  const { data: bodega } = await admin.from('bodegas').select('id').eq('empresa_id', EID).limit(1).single()
  const bodegaId = bodega?.id
  if (!bodegaId) { console.error('No bodega found'); process.exit(1) }
  log('Bodega:', bodegaId)

  // Leer productos de la empresa
  const { data: prods } = await admin.from('productos').select('id, codigo, descripcion').eq('empresa_id', EID)
  log(`${prods.length} productos en DB`)

  // Leer CSV para obtener stock
  const raw = readFileSync('/tmp/productos.xlsx', 'utf-8')
  const rows = parseCsv(raw, ';')

  const stockMap = {}
  for (const r of rows) {
    const cod = (r['Codigo'] ?? '').trim()
    const desc = r['Descripcion']?.trim()
    const s = parseInt(r['Stock'] ?? '0')
    const cantidad = s === 7777 ? 9999 : s
    if (cod) stockMap[cod] = cantidad
    else if (desc) stockMap[`__desc__${desc}`] = cantidad
  }

  // Verificar cuáles ya tienen stock
  const { data: existentes } = await admin.from('stock').select('producto_id').eq('bodega_id', bodegaId)
  const yaConStock = new Set((existentes ?? []).map(e => e.producto_id))
  log(`${yaConStock.size} productos ya tienen stock`)

  const sinStock = prods.filter(p => !yaConStock.has(p.id))
  log(`${sinStock.length} productos sin stock — insertando…`)

  const stockRows = sinStock.map(p => {
    const cantidad = stockMap[p.codigo ?? ''] ?? stockMap[`__desc__${p.descripcion}`] ?? 0
    return { producto_id: p.id, bodega_id: bodegaId, cantidad, cantidad_minima: 0 }
  })

  let total = 0
  for (let i = 0; i < stockRows.length; i += 200) {
    const { error } = await admin.from('stock').insert(stockRows.slice(i, i + 200))
    if (error) warn(`chunk ${i}: ${error.message}`)
    else total += Math.min(200, stockRows.length - i)
  }
  log(`Stock insertado: ${total} filas`)
}

main().catch(console.error)
