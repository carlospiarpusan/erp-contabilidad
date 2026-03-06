import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const EID = '948ce6fc-6337-4f39-9e80-7b2c0ce0166c'
const data = JSON.parse(readFileSync('/tmp/compras_2024_2026.json', 'utf8'))
const facturas = data['2024']

// Cargar proveedores
const { data: proveedores } = await admin.from('proveedores').select('id, razon_social').eq('empresa_id', EID)
const mapa = {}
for (const p of proveedores ?? []) mapa[p.razon_social.toUpperCase().trim()] = p.id
console.log('Proveedores:', Object.keys(mapa))

// Verificar ya importadas (por numero_externo)
const { data: existentes } = await admin.from('documentos').select('numero_externo').eq('empresa_id', EID).eq('tipo', 'factura_compra')
const yaImportados = new Set((existentes ?? []).map(d => d.numero_externo))
console.log('Ya importadas:', yaImportados.size)

const nuevas = facturas.filter(f => !yaImportados.has(f.numero_externo) && !yaImportados.has(f.numero))

const docs = nuevas.map((f, i) => ({
  empresa_id: EID,
  tipo: 'factura_compra',
  numero: 100 + i,
  prefijo: 'C',
  numero_externo: f.numero_externo || f.numero,
  proveedor_id: mapa[f.proveedor.toUpperCase().trim()] ?? null,
  fecha: f.fecha,
  total: f.total,
  subtotal: f.total,
  estado: f.estado,
  observaciones: f.observaciones ?? 'Importado desde Coin In ERP',
}))

console.log('A insertar:', docs.length)
if (docs.length === 0) { console.log('Nada nuevo que importar'); process.exit(0) }

const { error } = await admin.from('documentos').insert(docs)
if (error) { console.error('Error:', error.message); process.exit(1) }
console.log(`✅ ${docs.length} facturas de compra 2024 importadas`)
