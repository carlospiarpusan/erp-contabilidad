import test from 'node:test'
import assert from 'node:assert/strict'
import { HttpError, getErrorStatus, toErrorMsg } from '../../src/lib/utils/errors'

test('getErrorStatus prioriza HttpError', () => {
  assert.equal(getErrorStatus(new HttpError('bloqueado', 409)), 409)
})

test('getErrorStatus mapea códigos conocidos', () => {
  assert.equal(getErrorStatus({ code: '23505' }), 409)
  assert.equal(getErrorStatus({ code: 'PGRST116' }), 404)
  assert.equal(getErrorStatus({}), 500)
})

test('toErrorMsg extrae mensajes legibles', () => {
  assert.equal(toErrorMsg(new Error('falló')), 'falló')
  assert.equal(toErrorMsg({ message: 'mensaje objeto' }), 'mensaje objeto')
  assert.equal(toErrorMsg('texto plano'), 'texto plano')
})
