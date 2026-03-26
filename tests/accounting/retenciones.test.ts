import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularRetencionesSeleccionadas } from '../../src/lib/accounting/retenciones'

test('calcula retenciones por porcentaje sobre la base por defecto', () => {
  const result = calcularRetencionesSeleccionadas({
    defaultBase: 100000,
    definitions: [
      {
        id: 'retefuente',
        tipo: 'retefuente',
        nombre: 'ReteFuente 2.5',
        porcentaje: 2.5,
      },
    ],
    selections: [{ retencion_id: 'retefuente' }],
  })

  assert.equal(result.items.length, 1)
  assert.equal(result.items[0]?.valor, 2500)
  assert.equal(result.total, 2500)
})

test('respeta base mínima en pesos y UVT', () => {
  const result = calcularRetencionesSeleccionadas({
    defaultBase: 120000,
    uvtValue: 47065,
    definitions: [
      {
        id: 'reteiva',
        tipo: 'reteiva',
        nombre: 'ReteIVA',
        porcentaje: 15,
        base_minima: 200000,
        base_uvt: 4,
      },
    ],
    selections: [{ retencion_id: 'reteiva' }],
  })

  assert.equal(result.items.length, 0)
  assert.equal(result.total, 0)
})

test('permite valor manual cuando la retención ya fue calculada externamente', () => {
  const result = calcularRetencionesSeleccionadas({
    defaultBase: 100000,
    definitions: [
      {
        id: 'reteica',
        tipo: 'reteica',
        nombre: 'ReteICA',
        porcentaje: 0.966,
      },
    ],
    selections: [{ retencion_id: 'reteica', valor: 830 }],
  })

  assert.equal(result.items[0]?.valor, 830)
  assert.equal(result.total, 830)
})
