import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeTender,
  match,
  accepts,
  filterSchema,
  parseDate,
  csvCell,
  effectiveStatus,
} from '../src/domain.mjs'

test('Chilean deadlines preserve DST and explicit UTC offsets', () => {
  assert.equal(parseDate('2026-01-10T12:00:00'), '2026-01-10T15:00:00.000Z')
  assert.equal(parseDate('2026-07-10T12:00:00'), '2026-07-10T16:00:00.000Z')
  assert.equal(parseDate('2026-07-10T12:00:00Z'), '2026-07-10T12:00:00.000Z')
  assert.equal(parseDate('no es fecha'), null)
})
test('summary normalization never invents buyer, budget or items', () => {
  const t = normalizeTender({
    CodigoExterno: '123-4-L126',
    Nombre: 'Portal',
    CodigoEstado: 5,
    FechaCierre: '2026-12-01T15:00:00',
  })
  assert.equal(t.buyer, '')
  assert.equal(t.amount, null)
  assert.deepEqual(t.items, [])
  assert.equal(t.detailed, false)
  assert.equal(
    normalizeTender(
      {
        CodigoExterno: '123-4-L126',
        Nombre: 'Portal',
        MontoEstimado: 123,
        VisibilidadMonto: 0,
      },
      true,
    ).amount,
    null,
  )
  assert.throws(() =>
    normalizeTender({ CodigoExterno: '<script>', Nombre: 'X' }),
  )
})
test('matching is accent insensitive, explicit and respects exclusions', () => {
  const t = {
    title: 'Capacitación en programación',
    description: 'software',
    items: [],
    region: 'Valparaíso',
    status: 'open',
    closesAt: '2099-01-01T00:00:00Z',
  }
  const p = {
    keywords: ['capacitacion', 'software'],
    excludes: [],
    regions: ['Valparaíso'],
  }
  assert.equal(match(t, p).score, 60)
  assert.equal(
    accepts(t, filterSchema.parse({ q: 'programacion capacitacion' }), p),
    true,
  )
  assert.equal(
    accepts(t, filterSchema.parse({}), { ...p, excludes: ['programación'] }),
    false,
  )
  assert.equal(accepts(t, filterSchema.parse({ closingDays: 2 }), p), false)
})
test('past deadlines do not appear as open even with a stale source state', () => {
  assert.equal(
    effectiveStatus({ status: 'open', closesAt: '2020-01-01T00:00:00Z' }),
    'closed',
  )
  assert.equal(
    effectiveStatus({ status: 'suspended', closesAt: '2020-01-01T00:00:00Z' }),
    'suspended',
  )
})
test('CSV quoting neutralizes formulas including leading whitespace and embedded quotes', () => {
  assert.equal(csvCell(' =HYPERLINK("x")'), '"\' =HYPERLINK(""x"")"')
  assert.equal(csvCell('a;b\nc'), '"a;b\nc"')
})
