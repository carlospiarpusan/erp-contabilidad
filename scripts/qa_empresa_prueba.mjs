#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(fileName) {
  const fullPath = resolve(process.cwd(), fileName)
  if (!existsSync(fullPath)) return

  const lines = readFileSync(fullPath, 'utf8').split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Falta variable de entorno: ${name}`)
  return value
}

function mustOk(error, label) {
  if (error) throw new Error(`${label}: ${error.message}`)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function retryingFetch(input, init) {
  const maxAttempts = 4
  let lastError

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(input, init)
      if (response.status >= 500 && attempt < maxAttempts) {
        await wait(250 * attempt)
        continue
      }
      return response
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts) {
        await wait(250 * attempt)
        continue
      }
      throw error
    }
  }

  throw lastError ?? new Error('Fetch failed')
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const SUPABASE_URL = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const ANON_KEY = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const SERVICE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { fetch: retryingFetch },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    global: { fetch: retryingFetch },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const now = new Date()
  const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const year = now.getUTCFullYear()
  const today = now.toISOString().slice(0, 10)
  const companyName = `QA Empresa ${today} ${runId.slice(-4)}`
  const nit = `9${runId.slice(-9)}`
  const adminEmail = `qa.admin.${runId}@example.com`
  const adminPassword = `Qa_${runId.slice(-8)}!Aa`
  const adminName = 'Admin QA'

  const checks = []
  const state = {
    empresaId: null,
    ejercicioId: null,
    bodegaId: null,
    formaPagoId: null,
    impuesto0Id: null,
    impuesto19Id: null,
    colaboradorId: null,
    clienteId: null,
    proveedorId: null,
    acreedorId: null,
    tipoGastoId: null,
    productoBaseId: null,
    facturaVentaId: null,
    facturaCompraId: null,
  }

  async function check(name, fn) {
    const started = Date.now()
    try {
      await fn()
      checks.push({ name, ok: true, ms: Date.now() - started })
      console.log(`OK   ${name}`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      checks.push({ name, ok: false, ms: Date.now() - started, error: msg })
      console.log(`FAIL ${name}: ${msg}`)
    }
  }

  async function createCompanyAndAdmin() {
    const { data: empresa, error: empresaErr } = await admin
      .from('empresas')
      .insert({
        nombre: companyName,
        nit,
        razon_social: companyName,
        ciudad: 'Ipiales',
        departamento: 'Nariño',
        pais: 'Colombia',
        activa: true,
      })
      .select('id')
      .single()
    mustOk(empresaErr, 'Crear empresa')
    state.empresaId = empresa.id

    const { data: role, error: roleErr } = await admin
      .from('roles')
      .select('id')
      .eq('nombre', 'admin')
      .single()
    mustOk(roleErr, 'Buscar rol admin')

    const { data: userData, error: authErr } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { nombre: adminName },
    })
    mustOk(authErr, 'Crear usuario auth')
    const authUserId = userData.user?.id
    assert(authUserId, 'No se obtuvo id del usuario auth')

    const { error: userErr } = await admin.from('usuarios').upsert(
      {
        id: authUserId,
        empresa_id: state.empresaId,
        rol_id: role.id,
        nombre: adminName,
        email: adminEmail,
        activo: true,
      },
      { onConflict: 'id' }
    )
    mustOk(userErr, 'Crear usuario en tabla usuarios')
  }

  async function seedBaseData() {
    const pucRows = [
      ['110505', 'Caja General', 'activo', 4, 'debito'],
      ['111005', 'Banco Principal', 'activo', 4, 'debito'],
      ['130505', 'Clientes Nacionales', 'activo', 4, 'debito'],
      ['143505', 'Inventario de Mercancias', 'activo', 4, 'debito'],
      ['220505', 'Proveedores Nacionales', 'pasivo', 4, 'credito'],
      ['233505', 'Acreedores', 'pasivo', 4, 'credito'],
      ['240805', 'IVA Generado', 'pasivo', 4, 'credito'],
      ['240806', 'IVA Descontable', 'pasivo', 4, 'debito'],
      ['413505', 'Ventas de Mercancias', 'ingreso', 4, 'credito'],
      ['613505', 'Costo de Mercancia Vendida', 'costo', 4, 'debito'],
      ['513510', 'Transporte y fletes', 'gasto', 4, 'debito'],
    ].map(([codigo, descripcion, tipo, nivel, naturaleza]) => ({
      empresa_id: state.empresaId,
      codigo,
      descripcion,
      tipo,
      nivel,
      naturaleza,
      activa: true,
    }))

    const consecutivosRows = [
      ['Factura venta', 'factura_venta', 'FV'],
      ['Factura compra', 'factura_compra', 'FC'],
      ['Nota credito', 'nota_credito', 'NC'],
      ['Nota debito', 'nota_debito', 'ND'],
      ['Recibos de venta', 'recibo_venta', 'RV'],
      ['Recibos de compra', 'recibo_compra', 'RC'],
      ['Gastos', 'gasto', 'G'],
      ['Asientos', 'asiento', 'A'],
      ['Cotizaciones', 'cotizacion', 'CO'],
      ['Pedidos', 'pedido', 'PE'],
      ['Remisiones', 'remision', 'RE'],
      ['Ordenes de compra', 'orden_compra', 'OC'],
    ].map(([descripcion, tipo, prefijo]) => ({
      empresa_id: state.empresaId,
      descripcion,
      tipo,
      prefijo,
      consecutivo_actual: 0,
      activo: true,
    }))

    const { data: ejercicio, error: ejercicioErr } = await admin
      .from('ejercicios')
      .upsert(
        {
          empresa_id: state.empresaId,
          año: year,
          fecha_inicio: `${year}-01-01`,
          fecha_fin: `${year}-12-31`,
          estado: 'activo',
        },
        { onConflict: 'empresa_id,año' }
      )
      .select('id')
      .single()
    mustOk(ejercicioErr, 'Crear ejercicio')
    state.ejercicioId = ejercicio.id

    const { data: bodega, error: bodegaErr } = await admin
      .from('bodegas')
      .upsert(
        {
          empresa_id: state.empresaId,
          codigo: '001',
          nombre: 'Bodega Principal',
          principal: true,
          activa: true,
        },
        { onConflict: 'empresa_id,codigo' }
      )
      .select('id')
      .single()
    mustOk(bodegaErr, 'Crear bodega')
    state.bodegaId = bodega.id

    const { error: pucErr } = await admin
      .from('cuentas_puc')
      .upsert(pucRows, { onConflict: 'empresa_id,codigo' })
    mustOk(pucErr, 'Crear cuentas PUC')

    const { data: cuentas, error: cuentasErr } = await admin
      .from('cuentas_puc')
      .select('id,codigo')
      .eq('empresa_id', state.empresaId)
      .in('codigo', pucRows.map((r) => r.codigo))
    mustOk(cuentasErr, 'Leer cuentas PUC')
    const cuentasByCode = Object.fromEntries((cuentas ?? []).map((r) => [r.codigo, r.id]))

    const { error: impuestosErr } = await admin.from('impuestos').upsert(
      [
        {
          empresa_id: state.empresaId,
          codigo: 'CO0',
          descripcion: 'IVA 0%',
          porcentaje: 0,
          por_defecto: false,
        },
        {
          empresa_id: state.empresaId,
          codigo: 'CO19',
          descripcion: 'IVA 19%',
          porcentaje: 19,
          por_defecto: true,
          subcuenta_ventas_id: cuentasByCode['240805'],
          subcuenta_compras_id: cuentasByCode['240806'],
        },
      ],
      { onConflict: 'empresa_id,codigo' }
    )
    mustOk(impuestosErr, 'Crear impuestos')

    const { data: impuestos, error: impReadErr } = await admin
      .from('impuestos')
      .select('id,codigo')
      .eq('empresa_id', state.empresaId)
      .in('codigo', ['CO0', 'CO19'])
    mustOk(impReadErr, 'Leer impuestos')
    state.impuesto0Id = impuestos?.find((r) => r.codigo === 'CO0')?.id ?? null
    state.impuesto19Id = impuestos?.find((r) => r.codigo === 'CO19')?.id ?? null
    assert(state.impuesto0Id, 'No se creó impuesto CO0')
    assert(state.impuesto19Id, 'No se creó impuesto CO19')

    const { data: formaPago, error: formaPagoErr } = await admin
      .from('formas_pago')
      .insert({
        empresa_id: state.empresaId,
        descripcion: 'Efectivo',
        tipo: 'contado',
        dias_vencimiento: 0,
        cuenta_id: cuentasByCode['110505'],
        activa: true,
      })
      .select('id')
      .single()
    mustOk(formaPagoErr, 'Crear forma de pago')
    state.formaPagoId = formaPago.id

    const { error: consecutivosErr } = await admin
      .from('consecutivos')
      .insert(consecutivosRows)
    mustOk(consecutivosErr, 'Crear consecutivos')

    const { error: ceErr } = await admin.from('cuentas_especiales').upsert(
      [
        ['caja', '110505'],
        ['banco', '111005'],
        ['clientes', '130505'],
        ['inventario', '143505'],
        ['proveedores', '220505'],
        ['acreedores', '233505'],
        ['iva_ventas', '240805'],
        ['iva_compras', '240806'],
        ['ingresos', '413505'],
        ['costo_ventas', '613505'],
      ].map(([tipo, codigo]) => ({
        empresa_id: state.empresaId,
        tipo,
        cuenta_id: cuentasByCode[codigo],
      })),
      { onConflict: 'empresa_id,tipo' }
    )
    mustOk(ceErr, 'Crear cuentas especiales')

    const { error: maestrosErr } = await admin.from('familias').insert({
      empresa_id: state.empresaId,
      nombre: 'GENERAL',
      descripcion: 'Categoria QA',
    })
    if (maestrosErr && !maestrosErr.message.includes('duplicate key')) {
      throw new Error(`Crear familia: ${maestrosErr.message}`)
    }

    const { error: fabErr } = await admin.from('fabricantes').insert({
      empresa_id: state.empresaId,
      nombre: 'GENERIC QA',
    })
    if (fabErr && !fabErr.message.includes('duplicate key')) {
      throw new Error(`Crear fabricante: ${fabErr.message}`)
    }

    const { data: colaborador, error: colErr } = await admin
      .from('colaboradores')
      .insert({
        empresa_id: state.empresaId,
        nombre: 'Vendedor QA',
        email: `vendedor.${runId}@example.com`,
        activo: true,
      })
      .select('id')
      .single()
    mustOk(colErr, 'Crear colaborador')
    state.colaboradorId = colaborador.id

    const { data: cliente, error: clienteErr } = await admin
      .from('clientes')
      .insert({
        empresa_id: state.empresaId,
        razon_social: 'Cliente Base QA',
        tipo_documento: 'CC',
        numero_documento: `${runId.slice(-8)}`,
        email: `cliente.${runId}@example.com`,
        activo: true,
      })
      .select('id')
      .single()
    mustOk(clienteErr, 'Crear cliente base')
    state.clienteId = cliente.id

    const { data: proveedor, error: proveedorErr } = await admin
      .from('proveedores')
      .insert({
        empresa_id: state.empresaId,
        razon_social: 'Proveedor Base QA',
        tipo_documento: 'NIT',
        numero_documento: `${runId.slice(-9)}`,
        email: `proveedor.${runId}@example.com`,
        activo: true,
      })
      .select('id')
      .single()
    mustOk(proveedorErr, 'Crear proveedor base')
    state.proveedorId = proveedor.id

    const { data: acreedor, error: acreedorErr } = await admin
      .from('acreedores')
      .insert({
        empresa_id: state.empresaId,
        razon_social: 'Acreedor Base QA',
        numero_documento: `${runId.slice(-7)}`,
        email: `acreedor.${runId}@example.com`,
        activo: true,
      })
      .select('id')
      .single()
    mustOk(acreedorErr, 'Crear acreedor base')
    state.acreedorId = acreedor.id

    const { data: tipoGasto, error: tgErr } = await admin
      .from('tipos_gasto')
      .insert({
        empresa_id: state.empresaId,
        descripcion: 'Logistica QA',
        cuenta_id: cuentasByCode['513510'],
        valor_estimado: 0,
      })
      .select('id')
      .single()
    mustOk(tgErr, 'Crear tipo de gasto')
    state.tipoGastoId = tipoGasto.id

    const { data: producto, error: productoErr } = await admin
      .from('productos')
      .insert({
        empresa_id: state.empresaId,
        codigo: `QA-BASE-${runId.slice(-6)}`,
        descripcion: 'Producto Base QA',
        precio_venta: 120000,
        precio_compra: 80000,
        impuesto_id: state.impuesto19Id,
        activo: true,
      })
      .select('id')
      .single()
    mustOk(productoErr, 'Crear producto base')
    state.productoBaseId = producto.id

    const { error: stockErr } = await admin.from('stock').upsert(
      {
        producto_id: state.productoBaseId,
        variante_id: null,
        bodega_id: state.bodegaId,
        cantidad: 20,
        cantidad_minima: 5,
      },
      { onConflict: 'producto_id,variante_id,bodega_id' }
    )
    mustOk(stockErr, 'Crear stock base')
  }

  async function loginAsQaAdmin() {
    const { data, error } = await anon.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    })
    mustOk(error, 'Login admin QA')
    assert(data.user?.id, 'Login sin user id')
  }

  await createCompanyAndAdmin()
  await seedBaseData()
  await loginAsQaAdmin()

  await check('Sesion y datos base', async () => {
    const {
      data: { user },
      error: userErr,
    } = await anon.auth.getUser()
    mustOk(userErr, 'Obtener usuario autenticado')
    assert(user?.email === adminEmail, 'Usuario autenticado no coincide')

    const { data: usuario, error: dbUserErr } = await anon
      .from('usuarios')
      .select('id,empresa_id,email')
      .eq('id', user.id)
      .single()
    mustOk(dbUserErr, 'Leer usuario en DB')
    assert(usuario.empresa_id === state.empresaId, 'empresa_id de sesión no coincide')
  })

  await check('CRUD clientes', async () => {
    const doc = `${runId.slice(-8)}01`
    const { data: created, error: createErr } = await anon
      .from('clientes')
      .insert({
        empresa_id: state.empresaId,
        razon_social: 'Cliente CRUD QA',
        tipo_documento: 'CC',
        numero_documento: doc,
        telefono: '3000000000',
        activo: true,
      })
      .select('id,telefono')
      .single()
    mustOk(createErr, 'Crear cliente')

    const { data: updated, error: updateErr } = await anon
      .from('clientes')
      .update({ telefono: '3111111111' })
      .eq('id', created.id)
      .select('telefono')
      .single()
    mustOk(updateErr, 'Actualizar cliente')
    assert(updated.telefono === '3111111111', 'No actualizó teléfono de cliente')
  })

  await check('CRUD proveedores', async () => {
    const { data: created, error: createErr } = await anon
      .from('proveedores')
      .insert({
        empresa_id: state.empresaId,
        razon_social: 'Proveedor CRUD QA',
        tipo_documento: 'NIT',
        numero_documento: `${runId.slice(-9)}01`,
        telefono: '3200000000',
        activo: true,
      })
      .select('id,telefono')
      .single()
    mustOk(createErr, 'Crear proveedor')

    const { data: updated, error: updateErr } = await anon
      .from('proveedores')
      .update({ telefono: '3222222222' })
      .eq('id', created.id)
      .select('telefono')
      .single()
    mustOk(updateErr, 'Actualizar proveedor')
    assert(updated.telefono === '3222222222', 'No actualizó teléfono de proveedor')
  })

  await check('Inventario y stock', async () => {
    const { data: product, error: pErr } = await anon
      .from('productos')
      .insert({
        empresa_id: state.empresaId,
        codigo: `QA-STK-${runId.slice(-6)}`,
        descripcion: 'Producto Stock QA',
        precio_venta: 50000,
        precio_compra: 30000,
        impuesto_id: state.impuesto19Id,
        activo: true,
      })
      .select('id')
      .single()
    mustOk(pErr, 'Crear producto stock')

    const { error: movInErr } = await anon.rpc('secure_actualizar_stock', {
      p_producto_id: product.id,
      p_variante_id: null,
      p_bodega_id: state.bodegaId,
      p_cantidad: 10,
      p_tipo: 'ajuste_positivo',
      p_documento_id: null,
      p_precio_costo: 30000,
      p_numero_lote: null,
    })
    mustOk(movInErr, 'Entrada de stock')

    const { error: movOutErr } = await anon.rpc('secure_actualizar_stock', {
      p_producto_id: product.id,
      p_variante_id: null,
      p_bodega_id: state.bodegaId,
      p_cantidad: -3,
      p_tipo: 'ajuste_negativo',
      p_documento_id: null,
      p_precio_costo: 30000,
      p_numero_lote: null,
    })
    mustOk(movOutErr, 'Salida de stock')

    const { data: stockRow, error: stockErr } = await anon
      .from('stock')
      .select('cantidad')
      .eq('producto_id', product.id)
      .eq('bodega_id', state.bodegaId)
      .single()
    mustOk(stockErr, 'Consultar stock')
    assert(Number(stockRow.cantidad) === 7, `Stock esperado 7, recibido ${stockRow.cantidad}`)
  })

  await check('Ventas: factura + recibo + notas', async () => {
    const ventaLineas = [
      {
        producto_id: state.productoBaseId,
        variante_id: null,
        descripcion: 'Producto Base QA',
        cantidad: 2,
        precio_unitario: 120000,
        descuento_porcentaje: 0,
        impuesto_id: state.impuesto19Id,
      },
    ]

    const { data: facturaId, error: fvErr } = await anon.rpc('secure_crear_factura_venta', {
      p_ejercicio_id: state.ejercicioId,
      p_serie_tipo: 'factura_venta',
      p_cliente_id: state.clienteId,
      p_bodega_id: state.bodegaId,
      p_forma_pago_id: state.formaPagoId,
      p_colaborador_id: state.colaboradorId,
      p_fecha: today,
      p_vencimiento: today,
      p_observaciones: 'Factura QA',
      p_lineas: ventaLineas,
    })
    mustOk(fvErr, 'Crear factura venta')
    state.facturaVentaId = facturaId

    const { data: factura, error: docErr } = await anon
      .from('documentos')
      .select('id,total,estado')
      .eq('id', state.facturaVentaId)
      .single()
    mustOk(docErr, 'Leer factura venta')
    assert(Number(factura.total) > 0, 'Factura de venta con total 0')

    const { data: reciboId, error: rvErr } = await anon.rpc('secure_crear_recibo_venta', {
      p_documento_id: state.facturaVentaId,
      p_forma_pago_id: state.formaPagoId,
      p_ejercicio_id: state.ejercicioId,
      p_valor: factura.total,
      p_fecha: today,
      p_observaciones: 'Recibo QA',
    })
    mustOk(rvErr, 'Crear recibo venta')
    assert(reciboId, 'No se creó recibo de venta')

    const { data: facturaPagada, error: docEstadoErr } = await anon
      .from('documentos')
      .select('estado')
      .eq('id', state.facturaVentaId)
      .single()
    mustOk(docEstadoErr, 'Leer estado factura pagada')
    assert(facturaPagada.estado === 'pagada', 'La factura no quedó pagada')

    const { data: linea, error: lineaErr } = await anon
      .from('documentos_lineas')
      .select('id,cantidad')
      .eq('documento_id', state.facturaVentaId)
      .limit(1)
      .single()
    mustOk(lineaErr, 'Leer línea de factura')

    const { data: notaCreditoId, error: ncErr } = await anon.rpc('secure_crear_nota_credito', {
      p_ejercicio_id: state.ejercicioId,
      p_factura_id: state.facturaVentaId,
      p_motivo: 'Devolucion QA',
      p_lineas: [{ linea_id: linea.id, cantidad: 1 }],
    })
    mustOk(ncErr, 'Crear nota crédito')
    assert(notaCreditoId, 'No se creó nota crédito')

    const { data: notaDebitoId, error: ndErr } = await anon.rpc('secure_crear_nota_debito', {
      p_ejercicio_id: state.ejercicioId,
      p_cliente_id: state.clienteId,
      p_factura_id: state.facturaVentaId,
      p_motivo: 'Recargo QA',
      p_lineas: [
        {
          descripcion: 'Recargo por mora QA',
          cantidad: 1,
          precio_unitario: 10000,
          descuento_porcentaje: 0,
          impuesto_id: state.impuesto19Id,
        },
      ],
    })
    mustOk(ndErr, 'Crear nota débito')
    assert(notaDebitoId, 'No se creó nota débito')
  })

  await check('Compras: factura + pago', async () => {
    const compraLineas = [
      {
        producto_id: state.productoBaseId,
        variante_id: null,
        descripcion: 'Producto Base QA',
        cantidad: 4,
        precio_unitario: 70000,
        descuento_porcentaje: 0,
        impuesto_id: state.impuesto19Id,
      },
    ]

    const { data: facturaCompraId, error: fcErr } = await anon.rpc('secure_crear_factura_compra', {
      p_ejercicio_id: state.ejercicioId,
      p_proveedor_id: state.proveedorId,
      p_bodega_id: state.bodegaId,
      p_fecha: today,
      p_numero_externo: `EXT-${runId.slice(-6)}`,
      p_observaciones: 'Compra QA',
      p_lineas: compraLineas,
    })
    mustOk(fcErr, 'Crear factura compra')
    state.facturaCompraId = facturaCompraId

    const { data: compra, error: compraReadErr } = await anon
      .from('documentos')
      .select('id,total,estado')
      .eq('id', state.facturaCompraId)
      .single()
    mustOk(compraReadErr, 'Leer factura compra')

    const { data: pagoId, error: pagoErr } = await anon.rpc('secure_crear_pago_compra', {
      p_documento_id: state.facturaCompraId,
      p_forma_pago_id: state.formaPagoId,
      p_ejercicio_id: state.ejercicioId,
      p_valor: compra.total,
      p_fecha: today,
      p_observaciones: 'Pago compra QA',
    })
    mustOk(pagoErr, 'Crear pago de compra')
    assert(pagoId, 'No se creó pago de compra')

    const { data: compraPagada, error: compraEstadoErr } = await anon
      .from('documentos')
      .select('estado')
      .eq('id', state.facturaCompraId)
      .single()
    mustOk(compraEstadoErr, 'Leer estado factura compra')
    assert(compraPagada.estado === 'pagada', 'La factura de compra no quedó pagada')
  })

  await check('Gastos', async () => {
    const { data: gastoId, error: gastoErr } = await anon.rpc('secure_crear_gasto', {
      p_ejercicio_id: state.ejercicioId,
      p_acreedor_id: state.acreedorId,
      p_tipo_gasto_id: state.tipoGastoId,
      p_forma_pago_id: state.formaPagoId,
      p_fecha: today,
      p_descripcion: 'Gasto QA',
      p_valor: 55000,
      p_observaciones: 'Prueba QA',
    })
    mustOk(gastoErr, 'Crear gasto')
    assert(gastoId, 'No se creó gasto')
  })

  await check('Servicios y garantías', async () => {
    const servicioNumero = Number(runId.slice(-6))
    const garantiaNumero = Number(runId.slice(-5))

    const { data: servicio, error: servicioErr } = await anon
      .from('servicios_tecnicos')
      .insert({
        empresa_id: state.empresaId,
        numero: servicioNumero,
        cliente_id: state.clienteId,
        tipo: 'reparacion',
        servicio: 'Servicio QA',
        estado: 'abierto',
      })
      .select('id')
      .single()
    mustOk(servicioErr, 'Crear servicio técnico')

    const { data: garantia, error: garantiaErr } = await anon
      .from('garantias')
      .insert({
        empresa_id: state.empresaId,
        numero: garantiaNumero,
        cliente_id: state.clienteId,
        proveedor_id: state.proveedorId,
        producto_id: state.productoBaseId,
        estado: 'activa',
        servicio_tecnico_id: servicio.id,
      })
      .select('id')
      .single()
    mustOk(garantiaErr, 'Crear garantía')
    assert(garantia.id, 'No se creó garantía')
  })

  await check('Stock bajo y notificaciones', async () => {
    const { data: lowProduct, error: lowProductErr } = await anon
      .from('productos')
      .insert({
        empresa_id: state.empresaId,
        codigo: `QA-LOW-${runId.slice(-6)}`,
        descripcion: 'Producto Stock Bajo QA',
        precio_venta: 20000,
        precio_compra: 10000,
        impuesto_id: state.impuesto0Id,
        activo: true,
      })
      .select('id')
      .single()
    mustOk(lowProductErr, 'Crear producto stock bajo')

    const { error: inErr } = await anon.rpc('secure_actualizar_stock', {
      p_producto_id: lowProduct.id,
      p_variante_id: null,
      p_bodega_id: state.bodegaId,
      p_cantidad: 3,
      p_tipo: 'ajuste_positivo',
      p_documento_id: null,
      p_precio_costo: 10000,
      p_numero_lote: null,
    })
    mustOk(inErr, 'Inicializar stock de producto bajo')

    const { error: minErr } = await admin
      .from('stock')
      .update({ cantidad_minima: 5 })
      .eq('producto_id', lowProduct.id)
      .eq('bodega_id', state.bodegaId)
    mustOk(minErr, 'Ajustar cantidad mínima')

    const { error: outErr } = await anon.rpc('secure_actualizar_stock', {
      p_producto_id: lowProduct.id,
      p_variante_id: null,
      p_bodega_id: state.bodegaId,
      p_cantidad: -1,
      p_tipo: 'ajuste_negativo',
      p_documento_id: null,
      p_precio_costo: 10000,
      p_numero_lote: null,
    })
    mustOk(outErr, 'Bajar stock para notificación')

    const { data: notifs, error: notifErr } = await anon
      .from('notificaciones')
      .select('tipo,datos')
      .eq('tipo', 'stock_bajo')
      .order('created_at', { ascending: false })
      .limit(20)
    mustOk(notifErr, 'Consultar notificaciones')
    const found = (notifs ?? []).some((n) => n?.datos?.producto_id === lowProduct.id)
    assert(found, 'No se generó notificación de stock bajo')
  })

  await check('Contabilidad e informes', async () => {
    const { data: asientos, error: asErr } = await anon
      .from('asientos')
      .select('id', { count: 'exact' })
      .eq('empresa_id', state.empresaId)
    mustOk(asErr, 'Consultar asientos')
    assert((asientos ?? []).length > 0, 'No hay asientos contables')

    const { data: kpis, error: kpisErr } = await anon.rpc('secure_get_kpis_dashboard', {
      p_anio: year,
    })
    mustOk(kpisErr, 'Consultar KPIs dashboard')
    assert(kpis && typeof kpis === 'object', 'Respuesta inválida de KPIs')

    const { data: resumen, error: resumenErr } = await anon.rpc('secure_get_resumen_mensual', {
      p_anio: year,
    })
    mustOk(resumenErr, 'Consultar resumen mensual')
    assert(Array.isArray(resumen), 'Respuesta inválida de resumen mensual')

    const { data: pendientes, error: pendientesErr } = await anon.rpc('contar_sin_asiento', {
      p_empresa_id: state.empresaId,
    })
    mustOk(pendientesErr, 'Contar sin asiento')
    assert(Array.isArray(pendientes), 'contar_sin_asiento no devolvió tabla')

    const { error: generarErr } = await anon.rpc('generar_asientos_masivo', {
      p_empresa_id: state.empresaId,
    })
    mustOk(generarErr, 'Generar asientos masivo')
  })

  const passed = checks.filter((c) => c.ok).length
  const failed = checks.length - passed

  console.log('\n=== RESUMEN QA ===')
  for (const c of checks) {
    const badge = c.ok ? 'PASS' : 'FAIL'
    console.log(`${badge} | ${c.name} | ${c.ms}ms${c.ok ? '' : ` | ${c.error}`}`)
  }

  console.log('\n=== EMPRESA DE PRUEBA CREADA ===')
  console.log(`Empresa ID: ${state.empresaId}`)
  console.log(`Nombre:     ${companyName}`)
  console.log(`NIT:        ${nit}`)
  console.log(`Admin:      ${adminEmail}`)
  console.log(`Password:   ${adminPassword}`)

  if (failed > 0) {
    console.log(`\nResultado final: ${passed}/${checks.length} pruebas aprobadas, ${failed} fallidas.`)
    process.exit(1)
  }

  console.log(`\nResultado final: ${passed}/${checks.length} pruebas aprobadas.`)
}

main().catch((error) => {
  const msg = error instanceof Error ? error.message : String(error)
  console.error(`ERROR: ${msg}`)
  process.exit(1)
})
