import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const EID = '948ce6fc-6337-4f39-9e80-7b2c0ce0166c'

// 1. Cargar datos para sincronizar
const externalData = JSON.parse(readFileSync('/tmp/compras_all.json', 'utf8'))
console.log(`Datos externos (únicos): ${externalData.length}`)

// 2. Cargar lo que hay en DB
const { data: dbDocs } = await admin
  .from('documentos')
  .select('id, numero_externo, fecha, total')
  .eq('empresa_id', EID)
  .eq('tipo', 'factura_compra')
  .order('numero_externo')

console.log(`DB actual: ${dbDocs.length}`)

// 3. Detectar duplicados en DB (mismo numero_externo)
const mapaDb = {}
for (const d of dbDocs) {
  const key = (d.numero_externo || '').trim()
  if (!mapaDb[key]) mapaDb[key] = []
  mapaDb[key].push(d.id)
}

const duplicadosDb = Object.entries(mapaDb).filter(([, ids]) => ids.length > 1)
console.log(`\nDuplicados en DB: ${duplicadosDb.length}`)

// 4. Eliminar duplicados — conservar el primero, borrar el resto
let eliminados = 0
for (const [key, ids] of duplicadosDb) {
  const aEliminar = ids.slice(1) // conservar el primero
  console.log(`  Eliminando duplicados de "${key}": ${aEliminar.length} registros`)
  const { error } = await admin.from('documentos').delete().in('id', aEliminar)
  if (error) console.error('  Error al eliminar:', error.message)
  else eliminados += aEliminar.length
}
console.log(`Eliminados ${eliminados} duplicados de DB`)

// 5. Recargar DB después de limpiar
const { data: dbLimpia } = await admin
  .from('documentos')
  .select('id, numero_externo')
  .eq('empresa_id', EID)
  .eq('tipo', 'factura_compra')

const extantesSet = new Set((dbLimpia ?? []).map(d => (d.numero_externo || '').trim()))
console.log(`\nDB después de limpiar: ${extantesSet.size}`)

// 6. Cargar proveedores
const { data: proveedores } = await admin.from('proveedores').select('id, razon_social').eq('empresa_id', EID)
const mapaProveedores = {}
for (const p of proveedores ?? []) mapaProveedores[p.razon_social.toUpperCase().trim()] = p.id

// 7. Insertar los que faltan
const nuevas = externalData.filter(f => !extantesSet.has((f.numero_externo || '').trim()))
console.log(`A insertar (faltantes): ${nuevas.length}`)

if (nuevas.length > 0) {
  // Obtener el max numero actual para no colisionar
  const { data: maxRow } = await admin
    .from('documentos')
    .select('numero')
    .eq('empresa_id', EID)
    .eq('tipo', 'factura_compra')
    .order('numero', { ascending: false })
    .limit(1)
  const startNum = (maxRow?.[0]?.numero ?? 0) + 1

  const docs = nuevas.map((f, i) => ({
    empresa_id: EID,
    tipo: 'factura_compra',
    numero: startNum + i,
    prefijo: 'C',
    numero_externo: f.numero_externo || f.id_externo,
    proveedor_id: mapaProveedores[f.proveedor.toUpperCase().trim()] ?? null,
    fecha: f.fecha,
    total: f.total,
    subtotal: f.total,
    estado: f.estado,
    observaciones: f.observaciones ?? 'Importado desde archivo externo',
  }))

  const { error } = await admin.from('documentos').insert(docs)
  if (error) { console.error('Error al insertar:', error.message); process.exit(1) }
  console.log(`✅ ${docs.length} facturas nuevas insertadas`)
} else {
  console.log('✅ Sin facturas nuevas — DB ya está completa')
}

// 8. Resumen final
const { count } = await admin
  .from('documentos')
  .select('*', { count: 'exact', head: true })
  .eq('empresa_id', EID)
  .eq('tipo', 'factura_compra')

console.log(`\n📊 Total facturas de compra en DB: ${count}`)
console.log(`   El archivo tiene: ${externalData.length} únicas`)
