import test from 'node:test'
import assert from 'node:assert/strict'
import { getCancelacionContableError } from '../../src/lib/accounting/cancelaciones'

test('bloquea cancelar factura de venta ya contabilizada', () => {
  const error = getCancelacionContableError({
    tipo: 'factura_venta',
    estado: 'pendiente',
    asientosCount: 1,
    stockMovimientosCount: 1,
  })

  assert.ok(error)
  assert.equal(error?.status, 409)
  assert.match(error?.message ?? '', /nota crédito/i)
})

test('bloquea cancelar compra con pagos aplicados', () => {
  const error = getCancelacionContableError({
    tipo: 'factura_compra',
    estado: 'pendiente',
    recibosCount: 1,
  })

  assert.ok(error)
  assert.equal(error?.status, 409)
  assert.match(error?.message ?? '', /pagos aplicados/i)
})

test('permite cancelar solo si el documento ya estaba cancelado', () => {
  const error = getCancelacionContableError({
    tipo: 'gasto',
    estado: 'cancelada',
    asientosCount: 3,
    stockMovimientosCount: 0,
  })

  assert.equal(error, null)
})
