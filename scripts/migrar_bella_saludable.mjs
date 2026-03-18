/**
 * MIGRACIÓN: Crear empresa "Bella y Saludable" e importar datos desde Coin In
 * Uso: node scripts/migrar_bella_saludable.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// ── Supabase Admin Client (service role — bypasa RLS) ──────────────────────────
function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Falta la variable de entorno requerida: ${name}`)
  return value
}

const SUPABASE_URL = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
const ADMIN_EMAIL = requiredEnv('MIGRAR_BELLA_SALUDABLE_ADMIN_EMAIL')
const ADMIN_PASSWORD = requiredEnv('MIGRAR_BELLA_SALUDABLE_ADMIN_PASSWORD')

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ── Helpers ────────────────────────────────────────────────────────────────────
function log(msg) { console.log(`[migración] ${msg}`) }
function warn(msg) { console.warn(`[warn] ${msg}`) }

function parseCsv(text, delimiter = ',') {
  const lines = text.trim().split('\n').map(l => l.trim())
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^\uFEFF/, ''))
  return lines.slice(1).map(line => {
    const vals = line.split(delimiter)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim() })
    return obj
  })
}

async function insert(table, rows, label) {
  if (!rows.length) { log(`${label}: sin datos`); return }
  const { error } = await admin.from(table).insert(rows)
  if (error) { warn(`${label}: ${error.message}`); return false }
  log(`${label}: ${rows.length} registros insertados`)
  return true
}

// ── PASO 1: Crear usuario en Supabase Auth ──────────────────────────────────────
async function crearUsuarioAuth() {
  log('Creando usuario en Supabase Auth…')
  const { data, error } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  })
  if (error) {
    if (error.message.includes('already been registered') || error.message.includes('already exists')) {
      log('Usuario ya existe, buscando…')
      const { data: list } = await admin.auth.admin.listUsers()
      const user = list?.users?.find(u => u.email === ADMIN_EMAIL)
      if (user) return user.id
      throw new Error('No se pudo encontrar el usuario existente')
    }
    throw error
  }
  log(`Usuario creado: ${data.user.id}`)
  return data.user.id
}

// ── PASO 2: Crear empresa ──────────────────────────────────────────────────────
async function crearEmpresa() {
  log('Creando empresa Bella y Saludable…')
  const { data, error } = await admin
    .from('empresas')
    .upsert({
      nombre:      'Bella y Saludable',
      nit:         '1005272124',
      dv:          '0',
      razon_social:'Bella y Saludable',
      ciudad:      'Ipiales',
      departamento:'Nariño',
      pais:        'Colombia',
      telefono:    '3173321410',
      email:       ADMIN_EMAIL,
      regimen:     'simplificado',
      tipo_org:    'persona_natural',
    }, { onConflict: 'nit' })
    .select('id')
    .single()
  if (error) throw error
  log(`Empresa creada: ${data.id}`)
  return data.id
}

// ── PASO 3: Crear usuario en tabla usuarios ─────────────────────────────────────
async function crearUsuarioTabla(userId, empresaId) {
  log('Vinculando usuario a empresa…')
  // Obtener rol admin
  const { data: rol } = await admin
    .from('roles')
    .select('id')
    .eq('nombre', 'admin')
    .single()
  const rolId = rol?.id ?? null

  const { error } = await admin.from('usuarios').upsert({
    id:         userId,
    empresa_id: empresaId,
    rol_id:     rolId,
    nombre:     'Maria Esperanza Tengana',
    email:      ADMIN_EMAIL,
    activo:     true,
  }, { onConflict: 'id' })
  if (error) throw error
  log('Usuario vinculado')
}

// ── PASO 4: Seed datos base ─────────────────────────────────────────────────────
async function seedDatosBase(eid) {
  log('Insertando datos base…')

  // Ejercicios
  await insert('ejercicios', [
    { empresa_id: eid, año: 2024, fecha_inicio: '2024-01-01', fecha_fin: '2024-12-31', estado: 'cerrado' },
    { empresa_id: eid, año: 2025, fecha_inicio: '2025-01-01', fecha_fin: '2025-12-31', estado: 'cerrado' },
    { empresa_id: eid, año: 2026, fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', estado: 'activo' },
  ], 'Ejercicios')

  // Bodega
  await insert('bodegas', [
    { empresa_id: eid, codigo: '001', nombre: 'Bodega Principal', principal: true }
  ], 'Bodega')

  // Formas de pago
  await insert('formas_pago', [
    { empresa_id: eid, descripcion: 'Efectivo',                  tipo: 'contado', dias_vencimiento: 0 },
    { empresa_id: eid, descripcion: 'Transferencia Bancolombia',  tipo: 'contado', dias_vencimiento: 0 },
    { empresa_id: eid, descripcion: 'Nequi',                     tipo: 'contado', dias_vencimiento: 0 },
    { empresa_id: eid, descripcion: 'Daviplata',                  tipo: 'contado', dias_vencimiento: 0 },
    { empresa_id: eid, descripcion: 'Tarjeta débito o crédito',  tipo: 'contado', dias_vencimiento: 0 },
    { empresa_id: eid, descripcion: 'Contra entrega',             tipo: 'contado', dias_vencimiento: 3 },
    { empresa_id: eid, descripcion: 'A crédito 30 días',          tipo: 'credito', dias_vencimiento: 30 },
    { empresa_id: eid, descripcion: 'A crédito 60 días',          tipo: 'credito', dias_vencimiento: 60 },
  ], 'Formas de pago')

  // Consecutivos
  await insert('consecutivos', [
    { empresa_id: eid, descripcion: 'Facturación',            prefijo: 'F',   consecutivo_actual: 0, tipo: 'factura_venta' },
    { empresa_id: eid, descripcion: 'Facturación POS 1',      prefijo: 'P1',  consecutivo_actual: 0, tipo: 'factura_venta' },
    { empresa_id: eid, descripcion: 'Facturación POS 2',      prefijo: 'P2',  consecutivo_actual: 0, tipo: 'factura_venta' },
    { empresa_id: eid, descripcion: 'Nota Crédito',           prefijo: 'NC',  consecutivo_actual: 0, tipo: 'nota_credito'  },
    { empresa_id: eid, descripcion: 'Nota Débito',            prefijo: 'ND',  consecutivo_actual: 0, tipo: 'nota_debito'   },
    { empresa_id: eid, descripcion: 'Documento Soporte',      prefijo: 'DS',  consecutivo_actual: 0, tipo: 'factura_compra' },
    { empresa_id: eid, descripcion: 'Facturas de Compra',     prefijo: 'C',   consecutivo_actual: 0, tipo: 'factura_compra' },
    { empresa_id: eid, descripcion: 'Órdenes de Compra',      prefijo: 'OC',  consecutivo_actual: 0, tipo: 'orden_compra'  },
    { empresa_id: eid, descripcion: 'Cotizaciones',           prefijo: 'CO',  consecutivo_actual: 0, tipo: 'cotizacion'    },
    { empresa_id: eid, descripcion: 'Pedidos',                prefijo: 'PE',  consecutivo_actual: 0, tipo: 'pedido'        },
    { empresa_id: eid, descripcion: 'Remisiones',             prefijo: 'RE',  consecutivo_actual: 0, tipo: 'remision'      },
    { empresa_id: eid, descripcion: 'Recibos de Caja Ventas', prefijo: 'RV',  consecutivo_actual: 0, tipo: 'recibo_venta'  },
    { empresa_id: eid, descripcion: 'Recibos de Compra',      prefijo: 'RC',  consecutivo_actual: 0, tipo: 'recibo_compra' },
    { empresa_id: eid, descripcion: 'Gastos',                 prefijo: 'G',   consecutivo_actual: 0, tipo: 'gasto'         },
    { empresa_id: eid, descripcion: 'Asientos',               prefijo: 'A',   consecutivo_actual: 0, tipo: 'asiento'       },
  ], 'Consecutivos')

  // Tipos de gasto
  await insert('tipos_gasto', [
    { empresa_id: eid, descripcion: 'Arriendo' },
    { empresa_id: eid, descripcion: 'Servicios públicos' },
    { empresa_id: eid, descripcion: 'Transporte y fletes' },
    { empresa_id: eid, descripcion: 'Publicidad' },
    { empresa_id: eid, descripcion: 'Sueldos y salarios' },
    { empresa_id: eid, descripcion: 'Honorarios' },
    { empresa_id: eid, descripcion: 'Mantenimiento' },
    { empresa_id: eid, descripcion: 'Seguros' },
    { empresa_id: eid, descripcion: 'Papelería y útiles' },
    { empresa_id: eid, descripcion: 'Impuestos y contribuciones' },
    { empresa_id: eid, descripcion: 'Varios' },
  ], 'Tipos de gasto')

  // Transportadoras
  await insert('transportadoras', [
    { empresa_id: eid, nombre: 'Servientrega', url_rastreo: 'https://www.servientrega.com/rastreo' },
    { empresa_id: eid, nombre: 'Deprisa',      url_rastreo: 'https://www.deprisa.com/rastreo'     },
    { empresa_id: eid, nombre: 'Coordinadora', url_rastreo: 'https://www.coordinadora.com/rastreo' },
    { empresa_id: eid, nombre: 'Envía',        url_rastreo: 'https://www.envia.com.co/rastreo'     },
    { empresa_id: eid, nombre: 'TCC',          url_rastreo: 'https://www.tcc.com.co/rastreo'       },
  ], 'Transportadoras')

  // Colaboradores
  await insert('colaboradores', [
    { empresa_id: eid, nombre: 'Maria Esperanza Tengana', email: ADMIN_EMAIL, activo: true },
    { empresa_id: eid, nombre: 'Martha Jurado', activo: true },
    { empresa_id: eid, nombre: 'Pilar Revelo',  activo: true },
  ], 'Colaboradores')

  // PUC — Plan Único de Cuentas
  const puc = [
    // Clases
    [eid,'1','ACTIVO','activo',1,'debito'],
    [eid,'2','PASIVO','pasivo',1,'credito'],
    [eid,'3','PATRIMONIO','patrimonio',1,'credito'],
    [eid,'4','INGRESOS','ingreso',1,'credito'],
    [eid,'5','GASTOS','gasto',1,'debito'],
    [eid,'6','COSTO DE VENTAS','costo',1,'debito'],
    // Activo corriente
    [eid,'11','EFECTIVO Y EQUIVALENTES','activo',2,'debito'],
    [eid,'1105','Caja','activo',3,'debito'],
    [eid,'110505','Caja General','activo',4,'debito'],
    [eid,'1110','Bancos','activo',3,'debito'],
    [eid,'111005','Bancolombia Ahorros','activo',4,'debito'],
    [eid,'13','DEUDORES','activo',2,'debito'],
    [eid,'1305','Clientes','activo',3,'debito'],
    [eid,'130505','Clientes Nacionales','activo',4,'debito'],
    [eid,'14','INVENTARIOS','activo',2,'debito'],
    [eid,'1435','Mercancías no fabricadas por la empresa','activo',3,'debito'],
    [eid,'143505','Inventario de Mercancías','activo',4,'debito'],
    // Pasivo
    [eid,'22','PROVEEDORES','pasivo',2,'credito'],
    [eid,'2205','Proveedores Nacionales','pasivo',3,'credito'],
    [eid,'220505','Proveedores','pasivo',4,'credito'],
    [eid,'23','CUENTAS POR PAGAR','pasivo',2,'credito'],
    [eid,'2335','Costos y gastos por pagar','pasivo',3,'credito'],
    [eid,'233505','Gastos por pagar','pasivo',4,'credito'],
    [eid,'24','IMPUESTOS GRAVÁMENES Y TASAS','pasivo',2,'credito'],
    [eid,'2408','IVA por pagar','pasivo',3,'credito'],
    [eid,'240805','IVA Generado','pasivo',4,'credito'],
    [eid,'240806','IVA Descontable','pasivo',4,'debito'],
    // Ingresos
    [eid,'41','INGRESOS OPERACIONALES','ingreso',2,'credito'],
    [eid,'4135','Comercio al por mayor y al por menor','ingreso',3,'credito'],
    [eid,'413505','Ventas de Mercancías','ingreso',4,'credito'],
    // Costos
    [eid,'61','COSTO DE VENTAS Y PRESTACIÓN DE SERVICIOS','costo',2,'debito'],
    [eid,'6135','Comercio al por mayor y al por menor','costo',3,'debito'],
    [eid,'613505','Costo Mercancía Vendida','costo',4,'debito'],
    // Gastos
    [eid,'51','GASTOS OPERACIONALES DE ADMINISTRACIÓN','gasto',2,'debito'],
    [eid,'5105','Gastos de personal','gasto',3,'debito'],
    [eid,'510506','Sueldos','gasto',4,'debito'],
    [eid,'5110','Honorarios','gasto',3,'debito'],
    [eid,'5115','Impuestos','gasto',3,'debito'],
    [eid,'5120','Arrendamientos','gasto',3,'debito'],
    [eid,'5125','Contribuciones y afiliaciones','gasto',3,'debito'],
    [eid,'5130','Seguros','gasto',3,'debito'],
    [eid,'5135','Servicios','gasto',3,'debito'],
    [eid,'513510','Transporte, fletes y acarreos','gasto',4,'debito'],
    [eid,'513515','Publicidad y propaganda','gasto',4,'debito'],
    [eid,'5145','Mantenimiento y reparaciones','gasto',3,'debito'],
    [eid,'5195','Diversos','gasto',3,'debito'],
    [eid,'519595','Gastos varios','gasto',4,'debito'],
  ]
  const pucRows = puc.map(([e,c,d,t,n,nat]) => ({
    empresa_id: e, codigo: c, descripcion: d, tipo: t, nivel: n, naturaleza: nat
  }))
  await insert('cuentas_puc', pucRows, 'PUC')

  // Impuestos
  await insert('impuestos', [
    { empresa_id: eid, codigo: 'CO0',  descripcion: 'Exento de IVA (0%)', porcentaje: 0,  por_defecto: false },
    { empresa_id: eid, codigo: 'CO5',  descripcion: 'IVA 5%',             porcentaje: 5,  por_defecto: false },
    { empresa_id: eid, codigo: 'CO19', descripcion: 'IVA 19%',            porcentaje: 19, por_defecto: true  },
  ], 'Impuestos')

  // Asignar subcuentas a IVA
  const { data: iva } = await admin.from('impuestos').select('id').eq('empresa_id', eid).eq('codigo', 'CO19').single()
  const { data: ivaVentas }  = await admin.from('cuentas_puc').select('id').eq('empresa_id', eid).eq('codigo', '240805').single()
  const { data: ivaCompras } = await admin.from('cuentas_puc').select('id').eq('empresa_id', eid).eq('codigo', '240806').single()
  if (iva?.id && ivaVentas?.id && ivaCompras?.id) {
    await admin.from('impuestos').update({
      subcuenta_ventas_id:  ivaVentas.id,
      subcuenta_compras_id: ivaCompras.id,
    }).eq('id', iva.id)
    log('Subcuentas IVA asignadas')
  }

  // Cuentas especiales
  const cEspeciales = [
    ['caja',         '110505'],
    ['banco',        '111005'],
    ['clientes',     '130505'],
    ['inventario',   '143505'],
    ['proveedores',  '220505'],
    ['acreedores',   '233505'],
    ['iva_ventas',   '240805'],
    ['iva_compras',  '240806'],
    ['ingresos',     '413505'],
    ['costo_ventas', '613505'],
  ]
  const ceRows = []
  for (const [tipo, codigo] of cEspeciales) {
    const { data: cuenta } = await admin.from('cuentas_puc').select('id').eq('empresa_id', eid).eq('codigo', codigo).single()
    if (cuenta?.id) ceRows.push({ empresa_id: eid, tipo, cuenta_id: cuenta.id })
  }
  await insert('cuentas_especiales', ceRows, 'Cuentas especiales')

  // Familias
  await insert('familias', [
    { empresa_id: eid, nombre: 'FAJAS'        },
    { empresa_id: eid, nombre: 'BRASIER'      },
    { empresa_id: eid, nombre: 'ADELGAZANTES' },
    { empresa_id: eid, nombre: 'JABON'        },
    { empresa_id: eid, nombre: 'ACCESORIOS'   },
    { empresa_id: eid, nombre: 'SERVICIOS'    },
  ], 'Familias')

  // Fabricantes
  await insert('fabricantes', [
    { empresa_id: eid, nombre: 'FAJATE'    },
    { empresa_id: eid, nombre: 'IRENE MELO' },
    { empresa_id: eid, nombre: 'GENÉRICO'  },
  ], 'Fabricantes')
}

// ── PASO 5: Importar clientes ──────────────────────────────────────────────────
async function importarClientes(eid) {
  log('Importando clientes…')
  const raw = readFileSync('/tmp/clientes.csv', 'utf-8')
  const rows = parseCsv(raw)

  const tipoDocMap = {
    'Cedula':                    'CC',
    'NIT':                       'NIT',
    'Identificacion extranjero': 'CE',
    'Pasaporte':                 'PAS',
    'NUIP':                      'CC',
  }

  const clientes = rows.filter(r => r['CLIENTE']).map(r => ({
    empresa_id:      eid,
    razon_social:    r['CLIENTE']?.trim() || 'Sin nombre',
    nombre_contacto: r['NOMBRE CONTACTO']?.trim() || null,
    tipo_documento:  tipoDocMap[r['TIPO DOCUMENTO']?.trim()] ?? 'CC',
    numero_documento: r['DOCUMENTO']?.trim() || null,
    telefono:        r['TELEFONO']?.trim() || null,
    email:           r['EMAIL']?.trim() || null,
    departamento:    r['DEPARTAMENTO']?.trim() || null,
    ciudad:          r['CIUDAD']?.trim() || null,
    direccion:       r['DIRECCION']?.trim() || null,
    activo:          true,
  }))

  // Insertar en chunks de 50
  for (let i = 0; i < clientes.length; i += 50) {
    await insert('clientes', clientes.slice(i, i + 50), `Clientes chunk ${i}`)
  }
  log(`Total clientes: ${clientes.length}`)
}

// ── PASO 6: Importar proveedores ───────────────────────────────────────────────
async function importarProveedores(eid) {
  log('Importando proveedores…')
  const raw = readFileSync('/tmp/proveedores.xlsx', 'utf-8') // es CSV con ;
  const rows = parseCsv(raw, ';')

  const proveedores = rows.filter(r => r['Razon-Social']).map(r => ({
    empresa_id:      eid,
    razon_social:    r['Razon-Social']?.trim() || 'Sin nombre',
    contacto: r["Contacto"]?.trim() || null,
    numero_documento: r['Nit']?.trim() || null,
    tipo_documento:  'NIT',
    telefono:        r['Telefono']?.trim() || null,
    email:           r['Email']?.trim() || null,
    departamento:    r['Departamento']?.trim() || null,
    ciudad:          r['Ciudad']?.trim() || null,
    direccion:       r['Direccion']?.trim() || null,
    activo:          true,
  }))

  await insert('proveedores', proveedores, 'Proveedores')
}

// ── PASO 7: Importar productos ─────────────────────────────────────────────────
async function importarProductos(eid) {
  log('Importando productos…')
  const raw = readFileSync('/tmp/productos.xlsx', 'utf-8') // es CSV con ;

  // Obtener familias y fabricantes para hacer lookup
  const { data: familias }    = await admin.from('familias').select('id, nombre').eq('empresa_id', eid)
  const { data: fabricantes } = await admin.from('fabricantes').select('id, nombre').eq('empresa_id', eid)
  const { data: impuesto0 }   = await admin.from('impuestos').select('id').eq('empresa_id', eid).eq('codigo', 'CO0').single()
  const { data: impuesto19 }  = await admin.from('impuestos').select('id').eq('empresa_id', eid).eq('codigo', 'CO19').single()

  const famMap = Object.fromEntries((familias ?? []).map(f => [f.nombre.toUpperCase(), f.id]))
  const fabMap = Object.fromEntries((fabricantes ?? []).map(f => [f.nombre.toUpperCase(), f.id]))

  const rows = parseCsv(raw, ';')
  const productos = rows.filter(r => r['Descripcion']?.trim()).map(r => {
    const catNorm = (r['Categoria'] ?? '').trim().toUpperCase()
    const fabNorm = (r['Marca'] ?? '').trim().toUpperCase()
    const iva = parseInt(r['Iva'] ?? '0')
    const stock = parseInt(r['Stock'] ?? '0')

    return {
      empresa_id:    eid,
      codigo:        (r['Codigo'] ?? '').trim().replace(/^\s+/, '') || null,
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

  // Obtener bodega principal
  const { data: bodegaData } = await admin.from('bodegas').select('id').eq('empresa_id', eid).limit(1).single()
  const bodegaId = bodegaData?.id

  // Insertar en chunks de 100
  let total = 0
  for (let i = 0; i < productos.length; i += 100) {
    const chunk = productos.slice(i, i + 100)
    const stockMap = chunk.map(p => p._stock)
    const insertar = chunk.map(({ _stock, ...p }) => p)
    const { data: insertados, error } = await admin.from('productos').insert(insertar).select('id')
    if (error) { warn(`Productos chunk ${i}: ${error.message}`); continue }
    total += insertados.length

    // Insertar stock inicial en tabla stock
    if (bodegaId && insertados.length > 0) {
      const stockRows = insertados.map((p, idx) => ({
        empresa_id:      eid,
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

// ── MAIN ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n=== MIGRACIÓN: Bella y Saludable ===\n')

  try {
    const userId    = await crearUsuarioAuth()
    const empresaId = await crearEmpresa()
    await crearUsuarioTabla(userId, empresaId)
    await seedDatosBase(empresaId)
    await importarClientes(empresaId)
    await importarProveedores(empresaId)
    await importarProductos(empresaId)

    console.log('\n=== MIGRACIÓN COMPLETADA ===')
    console.log(`Empresa ID: ${empresaId}`)
    console.log(`Usuario ID: ${userId}`)
  } catch (err) {
    console.error('\n[ERROR]', err.message)
    process.exit(1)
  }
}

main()
