import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const EID = '948ce6fc-6337-4f39-9e80-7b2c0ce0166c'

const facturas = JSON.parse(readFileSync('/tmp/compras.json', 'utf8'))
console.log(`Importando ${facturas.length} facturas de compra…`)

// Cargar proveedores existentes
const { data: proveedores } = await admin
  .from('proveedores')
  .select('id, razon_social')
  .eq('empresa_id', EID)

const mapaProveedores = {}
for (const p of proveedores ?? []) {
  mapaProveedores[p.razon_social.toUpperCase().trim()] = p.id
}
console.log(`Proveedores disponibles: ${Object.keys(mapaProveedores).join(', ')}`)

// Construir documentos
let sinProveedor = 0
const docs = facturas.map((f, i) => {
  const provKey = f.proveedor.toUpperCase().trim()
  const proveedor_id = mapaProveedores[provKey] ?? null
  if (!proveedor_id) {
    console.warn(`  Sin proveedor para: "${f.proveedor}"`)
    sinProveedor++
  }
  return {
    empresa_id: EID,
    tipo: 'factura_compra',
    numero: i + 1,
    prefijo: 'C',
    numero_externo: f.numero_externo || f.numero,
    proveedor_id,
    fecha: f.fecha,
    total: f.total,
    subtotal: f.total,  // sin desglose de IVA disponible
    estado: f.estado,
    observaciones: f.observaciones ?? 'Importado desde Coin In ERP',
  }
})

if (sinProveedor > 0) {
  console.log(`\n⚠️  ${sinProveedor} facturas sin proveedor vinculado (se importarán igual)`)
}

// Insertar en lotes de 50
let insertados = 0
for (let i = 0; i < docs.length; i += 50) {
  const chunk = docs.slice(i, i + 50)
  const { error } = await admin.from('documentos').insert(chunk)
  if (error) {
    console.error('Error al insertar:', error.message)
    process.exit(1)
  }
  insertados += chunk.length
  console.log(`  ✓ ${insertados}/${docs.length} insertadas`)
}

console.log(`\n✅ ${insertados} facturas de compra importadas exitosamente`)
