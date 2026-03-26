import test from 'node:test'
import assert from 'node:assert/strict'
import { ACCOUNTING_ROLES, canAccessModule } from '../../src/lib/auth/permissions'

test('vendedor no tiene acceso de gestión a contabilidad', () => {
  assert.equal(canAccessModule('vendedor', 'contabilidad', 'manage'), false)
  assert.equal(canAccessModule('vendedor', 'ventas', 'manage'), true)
})

test('solo admin y contador pueden ejecutar acciones contables críticas', () => {
  assert.deepEqual([...ACCOUNTING_ROLES], ['admin', 'contador'])
})
