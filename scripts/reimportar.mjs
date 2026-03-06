import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const log  = (...a) => console.log('[migración]', ...a)
const warn = (...a) => console.warn('[warn]', ...a)

function parseCsv(raw, sep = ',') {
  const lines = raw.split(/\r?\n/).filter(l => l.trim())
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^\uFEFF/, ''))
  return lines.slice(1).map(line => {
    const vals = line.split(sep)
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]?.trim() ?? '']))
  })
}

// Empresa ID de la migración anterior
const EID = '948ce6fc-6337-4f39-9e80-7b2c0ce0166c'

async function reimportarProveedores() {
  log('Reimportando proveedores…')
  const raw = readFileSync('/tmp/proveedores.xlsx', 'utf-8')
  const rows = parseCsv(raw, ';')

  const proveedores = rows.filter(r => r['Razon-Social']).map(r => ({
    empresa_id:       EID,
    razon_social:     r['Razon-Social']?.trim() || 'Sin nombre',
    contacto:         r['Contacto']?.trim() || null,
    numero_documento: r['Nit']?.trim() || null,
    tipo_documento:   'NIT',
    telefono:         r['Telefono']?.trim() || null,
    email:            r['Email']?.trim() || null,
    departamento:     r['Departamento']?.trim() || null,
    ciudad:           r['Ciudad']?.trim() || null,
    direccion:        r['Direccion']?.trim() || null,
    activo:           true,
  }))

  const { error } = await admin.from('proveedores').insert(proveedores)
  if (error) warn('Proveedores:', error.message)
  else log(`Proveedores: ${proveedores.length} insertados`)
}

async function reimportarProductos() {
  log('Reimportando productos…')
  const raw = readFileSync('/tmp/productos.xlsx', 'utf-8')

  const { data: familias }   = await admin.from('familias').select('id, nombre').eq('empresa_id', EID)
  const { data: fabricantes }= await admin.from('fabricantes').select('id, nombre').eq('empresa_id', EID)
  const { data: impuesto0 }  = await admin.from('impuestos').select('id').eq('empresa_id', EID).eq('codigo', 'CO0').single()
  const { data: impuesto19 } = await admin.from('impuestos').select('id').eq('empresa_id', EID).eq('codigo', 'CO19').single()

  const famMap = Object.fromEntries((familias ?? []).map(f => [f.nombre.toUpperCase(), f.id]))
  const fabMap = Object.fromEntries((fabricantes ?? []).map(f => [f.nombre.toUpperCase(), f.id]))

  const { data: bodegaData } = await admin.from('bodegas').select('id').eq('empresa_id', EID).limit(1).single()
  const bodegaId = bodegaData?.id

  const rows = parseCsv(raw, ';')
  const productos = rows.filter(r => r['Descripcion']?.trim()).map(r => {
    const catNorm = (r['Categoria'] ?? '').trim().toUpperCase()
    const fabNorm = (r['Marca'] ?? '').trim().toUpperCase()
    const iva   = parseInt(r['Iva'] ?? '0')
    const stock = parseInt(r['Stock'] ?? '0')
    return {
      empresa_id:    EID,
      codigo:        (r['Codigo'] ?? '').trim() || null,
      descripcion:   r['Descripcion']?.trim(),
      codigo_barras: r['Cod-barras']?.trim() || null,
      precio_venta:  parseFloat(r['Precio-Venta'] ?? '0') || 0,
      precio_compra: parseFloat(r['Precio-Compra'] ?? '0') || 0,
      familia_id:    famMap[catNorm] ?? null,
      fabricante_id: fabMap[fabNorm] ?? null,
      impuesto_id:   iva > 0 ? impuesto19?.id : impuesto0?.id,
      activo:        true,
      _stock:        stock === 7777 ? 9999 : stock,
    }
  })

  let total = 0
  for (let i = 0; i < productos.length; i += 100) {
    const chunk = productos.slice(i, i + 100)
    const stockMap = chunk.map(p => p._stock)
    const insertar = chunk.map(({ _stock, ...p }) => p)

    const { data: insertados, error } = await admin.from('productos').insert(insertar).select('id')
    if (error) { warn(`Productos chunk ${i}: ${error.message}`); continue }
    total += insertados.length

    if (bodegaId && insertados.length > 0) {
      const stockRows = insertados.map((p, idx) => ({
        empresa_id:      EID,
        producto_id:     p.id,
        bodega_id:       bodegaId,
        cantidad:        stockMap[idx] ?? 0,
        cantidad_minima: 0,
      }))
      const { error: se } = await admin.from('stock').insert(stockRows)
      if (se) warn(`Stock chunk ${i}: ${se.message}`)
    }
  }
  log(`Total productos insertados: ${total}`)
}

async function main() {
  console.log('\n=== RE-IMPORTACIÓN: Bella y Saludable ===\n')
  await reimportarProveedores()
  await reimportarProductos()
  console.log('\n=== LISTO ===')
}

main().catch(console.error)
