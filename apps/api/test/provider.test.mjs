import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createProvider } from '../src/provider.mjs'
import { createSync, generateNotifications } from '../src/jobs.mjs'
import { openDb, putTender } from '../src/db.mjs'

test('provider only uses fixed host, normalizes detail, and does not leak upstream errors', async () => {
  let seen
  const provider = createProvider('test-ticket', async (url, options) => {
    seen = url
    assert.equal(options.redirect, 'error')
    return new Response(
      JSON.stringify({
        Listado: [
          {
            CodigoExterno: '123-4-L126',
            Nombre: 'Sitio web',
            CodigoEstado: 5,
            Comprador: {
              NombreOrganismo: 'Municipalidad',
              RegionUnidad: 'Valparaíso',
            },
            Fechas: { FechaCierre: '2026-12-01T12:00:00' },
            MontoEstimado: 1000,
            Moneda: 'CLP',
            VisibilidadMonto: 1,
          },
        ],
      }),
    )
  })
  const tender = await provider.detail('123-4-L126')
  assert.equal(seen.hostname, 'api.mercadopublico.cl')
  assert.equal(tender.amount, 1000)
  assert.equal(tender.region, 'Valparaíso')
  assert.equal(tender.closesAt, '2026-12-01T15:00:00.000Z')
  await assert.rejects(
    createProvider('secret', async () => {
      throw new Error('URL with secret')
    }).list('18102026'),
    (e) => e.code === 'UPSTREAM_UNAVAILABLE' && !e.message.includes('secret'),
  )
  await assert.rejects(
    createProvider('').list('18102026'),
    (e) => e.code === 'MISSING_TICKET',
  )
})
test('provider rejects incompatible source schemas and oversize payloads', async () => {
  await assert.rejects(
    createProvider('x', async () => new Response('{"Codigo":10200}')).list(
      '18102026',
    ),
    (e) => e.code === 'UPSTREAM_INVALID_RESPONSE',
  )
  await assert.rejects(
    createProvider(
      'x',
      async () =>
        new Response('x', { headers: { 'content-length': '9000000' } }),
    ).list('18102026'),
    (e) => e.code === 'UPSTREAM_TOO_LARGE',
  )
})
test('sync preserves detailed fields when importing summaries and records failures', async () => {
  const db = openDb(':memory:')
  const previous = {
    id: '123-4-L126',
    title: 'Antes',
    detailed: true,
    description: 'No borrar',
    buyer: 'Organismo',
    region: 'Valparaíso',
    status: 'open',
    closesAt: '2099-01-01T00:00:00Z',
    items: [],
  }
  putTender(db, previous, 'live')
  const provider = {
    list: async () => [
      {
        id: previous.id,
        title: 'Después',
        detailed: false,
        status: 'open',
        closesAt: previous.closesAt,
        fetchedAt: new Date().toISOString(),
      },
    ],
    detail: async () => {
      throw new Error('Unavailable')
    },
  }
  await createSync(db, provider, { days: 1, detailLimit: 0 })()
  assert.equal(
    JSON.parse(db.prepare('SELECT payload FROM tenders').get().payload)
      .description,
    'No borrar',
  )
  assert.equal(
    JSON.parse(db.prepare('SELECT payload FROM tenders').get().payload).title,
    'Después',
  )
  await createSync(
    db,
    {
      list: async () => {
        throw new Error('ticket in URL')
      },
      detail: async () => {},
    },
    { days: 1 },
  )()
  assert.equal(
    db.prepare("SELECT count(*) n FROM sync_runs WHERE status='error'").get().n,
    1,
  )
  assert.ok(
    !JSON.stringify(db.prepare('SELECT * FROM sync_runs').all()).includes(
      'ticket in URL',
    ),
  )
  db.close()
})
