import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import supertest from 'supertest'
import { openDb, uid } from '../src/db.mjs'
import { hashPassword } from '../src/auth.mjs'
import { createApp } from '../src/app.mjs'
import { seedDemo } from '../src/demo.mjs'
import { generateNotifications, createSync } from '../src/jobs.mjs'
import { createProvider } from '../src/provider.mjs'
const origin = 'http://localhost:5173',
  password = 'test-password-only-12345'
let db, app, a, b, csrfA, csrfB
const mutate = (agent, method, url, csrf, body = {}) =>
  agent[method](url).set('Origin', origin).set('X-CSRF-Token', csrf).send(body)
before(async () => {
  db = openDb(':memory:')
  seedDemo(db)
  const hash = await hashPassword(password)
  for (const letter of ['a', 'b']) {
    db.prepare('INSERT INTO organizations VALUES(?,?)').run(
      letter,
      'Org ' + letter,
    )
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(
      uid(),
      letter,
      `${letter}@example.test`,
      letter,
      hash,
      'admin',
    )
  }
  app = await createApp({
    db,
    provider: createProvider(''),
    sync: createSync(db, createProvider(''), { source: 'demo' }),
    config: {
      origin,
      demo: true,
      production: false,
      ticket: '',
      syncDays: 3,
      detailLimit: 30,
      syncMinutes: 30,
    },
  })
  a = supertest.agent(app)
  b = supertest.agent(app)
  for (const [agent, letter] of [
    [a, 'a'],
    [b, 'b'],
  ])
    await agent
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email: `${letter}@example.test`, password })
      .expect(200)
  csrfA = (await a.get('/api/auth/me')).body.csrf
  csrfB = (await b.get('/api/auth/me')).body.csrf
})
after(() => db.close())
test('private endpoints require auth; mutations require origin and CSRF', async () => {
  await supertest(app).get('/api/radar/tenders').expect(401)
  await a
    .post('/api/radar/tenders/DEMO-1/save')
    .set('Origin', origin)
    .send({})
    .expect(403)
  await a
    .post('/api/radar/tenders/DEMO-1/save')
    .set('Origin', 'https://evil.example')
    .set('X-CSRF-Token', csrfA)
    .send({})
    .expect(403)
})
test('tenant isolation for saved records, notes, tasks and optimistic concurrency', async () => {
  let r = await mutate(
    a,
    'post',
    '/api/radar/tenders/DEMO-1/save',
    csrfA,
  ).expect(200)
  const v = r.body.saved.version
  r = await mutate(a, 'patch', '/api/radar/tenders/DEMO-1/save', csrfA, {
    version: v,
    stage: 'preparing',
    owner: 'Equipo A',
    tasks: [],
  }).expect(200)
  await mutate(a, 'patch', '/api/radar/tenders/DEMO-1/save', csrfA, {
    version: v,
    stage: 'lost',
    owner: 'Stale',
    tasks: [],
  }).expect(409)
  await mutate(a, 'post', '/api/radar/tenders/DEMO-1/notes', csrfA, {
    text: 'Privado de A',
  }).expect(200)
  r = await b.get('/api/radar/tenders/DEMO-1').expect(200)
  assert.equal(r.body.saved, null)
  await mutate(b, 'post', '/api/radar/tenders/DEMO-1/notes', csrfB, {
    text: 'No debe añadirse',
  }).expect(404)
  await mutate(b, 'delete', '/api/radar/tenders/DEMO-1/save', csrfB).expect(200)
  r = await a.get('/api/radar/tenders/DEMO-1').expect(200)
  assert.equal(r.body.saved.notes[0].text, 'Privado de A')
  assert.equal(r.body.saved.stage, 'preparing')
})
test('search ownership, idempotent notifications and tenant isolation', async () => {
  await mutate(a, 'post', '/api/radar/searches', csrfA, {
    name: 'Software',
    filters: { q: 'software', status: 'open' },
  }).expect(201)
  const searches = (await a.get('/api/radar/searches')).body
  await mutate(b, 'patch', `/api/radar/searches/${searches[0].id}`, csrfB, {
    enabled: false,
  }).expect(404)
  const first = (await a.get('/api/radar/notifications')).body
  assert.ok(first.length > 0)
  generateNotifications(db, 'demo')
  generateNotifications(db, 'demo')
  assert.equal(
    (await a.get('/api/radar/notifications')).body.length,
    first.length,
  )
  await mutate(b, 'post', '/api/radar/notifications/read', csrfB, {
    id: first[0].id,
  }).expect(200)
  assert.equal((await a.get('/api/radar/notifications')).body[0].readAt, null)
  assert.equal((await b.get('/api/radar/notifications')).body.length, 0)
})
test('strict validation rejects mass assignment and malformed pagination', async () => {
  await mutate(a, 'post', '/api/radar/searches', csrfA, {
    name: 'Extra',
    filters: {},
    org_id: 'b',
  }).expect(400)
  await a.get('/api/radar/tenders?page=-1').expect(400)
  await a.get('/api/radar/tenders?closingDays=oops').expect(400)
})
test('server side profile versioning protects concurrent edits and ranks results', async () => {
  const body = {
    name: 'ExpressWebsite',
    keywords: ['software'],
    excludes: ['aseo'],
    regions: ['Valparaíso'],
    version: 0,
  }
  await mutate(a, 'put', '/api/radar/profile', csrfA, body).expect(200)
  await mutate(a, 'put', '/api/radar/profile', csrfA, body).expect(409)
  const response = await a
    .get('/api/radar/tenders?recommended=true')
    .expect(200)
  assert.ok(response.body.total > 0)
  assert.ok(
    response.body.items.every((t) => t.relevance.matched.includes('software')),
  )
  assert.equal((await b.get('/api/radar/overview')).body.profile.version, 0)
})
test('demo and live data cannot mix; tickets never appear in responses', async () => {
  const live = await createApp({
    db,
    provider: createProvider('super-secret-ticket'),
    sync: async () => false,
    config: {
      origin,
      demo: false,
      production: false,
      ticket: 'super-secret-ticket',
      syncDays: 3,
      detailLimit: 30,
      syncMinutes: 30,
    },
  })
  const agent = supertest.agent(live)
  await agent
    .post('/api/auth/login')
    .set('Origin', origin)
    .send({ email: 'a@example.test', password })
    .expect(200)
  const list = await agent.get('/api/radar/tenders').expect(200)
  assert.equal(list.body.total, 0)
  const response = await agent.get('/api/radar/overview').expect(200)
  assert.ok(!JSON.stringify(response.body).includes('super-secret-ticket'))
})
test('password rotation revokes all existing sessions', async () => {
  await mutate(b, 'post', '/api/auth/password', csrfB, {
    current: password,
    password: 'new-test-password-12345',
  }).expect(200)
  await b.get('/api/auth/me').expect(401)
})
