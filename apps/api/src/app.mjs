import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { uid, now, atomic, audit, putTender } from './db.mjs'
import {
  token,
  digest,
  hashPassword,
  verifyPassword,
  getSessionToken,
  sessionCookie,
} from './auth.mjs'
import {
  accepts,
  match,
  effectiveStatus,
  filterSchema,
  profileSchema,
  savedSchema,
  noteSchema,
  buildCsv,
} from './domain.mjs'
import { generateNotifications } from './jobs.mjs'

const fail = (status, message) => Object.assign(new Error(message), { status })
const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next)
const blankProfile = {
  name: 'Mi empresa',
  keywords: [],
  excludes: [],
  regions: [],
}
const codeSchema = z.string().regex(/^[\w-]{3,80}$/)
export async function createApp({ db, provider, sync, config }) {
  const app = express()
  const source = config.demo ? 'demo' : 'live'
  const dummy = await hashPassword(token())
  app.disable('x-powered-by')
  if (config.trustProxy) app.set('trust proxy', config.trustProxy)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      strictTransportSecurity: config.production ? undefined : false,
    }),
  )
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 240,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Demasiadas solicitudes. Espera un minuto.' },
    }),
  )
  app.use(express.json({ limit: '64kb' }))
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  app.get('/api/health', (_req, res) => {
    db.prepare('SELECT 1').get()
    res.json({ status: 'ok' })
  })
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
    if (req.headers.origin !== config.origin || !req.is('application/json'))
      return next(fail(403, 'Origen de solicitud no permitido.'))
    next()
  })
  const loginLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Intenta en 15 minutos.' },
  })
  app.post(
    '/api/auth/login',
    loginLimit,
    asyncRoute(async (req, res) => {
      const { email, password } = z
        .object({
          email: z.string().trim().email().max(254),
          password: z.string().min(1).max(256),
        })
        .strict()
        .parse(req.body)
      const user = db
        .prepare('SELECT * FROM users WHERE email=?')
        .get(email.toLowerCase())
      const valid = await verifyPassword(password, user?.password || dummy)
      if (!user || !valid) throw fail(401, 'Correo o contraseña incorrectos.')
      const raw = token(),
        csrf = token()
      atomic(db, () => {
        const old = getSessionToken(req)
        if (old)
          db.prepare('DELETE FROM sessions WHERE token=?').run(digest(old))
        db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now())
        db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(
          digest(raw),
          user.id,
          csrf,
          new Date(Date.now() + 43200000).toISOString(),
        )
        audit(db, user, 'login', 'session')
      })
      res
        .set('Set-Cookie', sessionCookie(raw, config.production))
        .json({ ok: true })
    }),
  )
  app.use('/api', (req, res, next) => {
    const raw = getSessionToken(req)
    const user = raw
      ? db
          .prepare(
            `SELECT u.*,s.csrf,s.token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?`,
          )
          .get(digest(raw), now())
      : null
    if (!user) return next(fail(401, 'Inicia sesión para continuar.'))
    req.user = user
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers['x-csrf-token'] !== user.csrf
    )
      return next(fail(403, 'Sesión no válida. Vuelve a iniciar sesión.'))
    next()
  })
  app.get('/api/auth/me', (req, res) => {
    const u = req.user
    const org = db
      .prepare('SELECT name FROM organizations WHERE id=?')
      .get(u.org_id)
    res.json({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      organization: org.name,
      csrf: u.csrf,
      demo: config.demo,
    })
  })
  app.post('/api/auth/logout', (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token=?').run(req.user.token)
    res
      .set('Set-Cookie', sessionCookie('', config.production, true))
      .json({ ok: true })
  })
  app.post(
    '/api/auth/password',
    asyncRoute(async (req, res) => {
      const body = z
        .object({
          current: z.string().min(1).max(256),
          password: z.string().min(14).max(256),
        })
        .strict()
        .parse(req.body)
      if (!(await verifyPassword(body.current, req.user.password)))
        throw fail(400, 'La contraseña actual no coincide.')
      const hash = await hashPassword(body.password)
      atomic(db, () => {
        db.prepare('UPDATE users SET password=? WHERE id=?').run(
          hash,
          req.user.id,
        )
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.user.id)
        audit(db, req.user, 'password_changed', 'account')
      })
      res
        .set('Set-Cookie', sessionCookie('', config.production, true))
        .json({ ok: true })
    }),
  )
  function getProfile(org) {
    const r = db.prepare('SELECT * FROM profiles WHERE org_id=?').get(org)
    return {
      ...(r ? JSON.parse(r.payload) : blankProfile),
      version: r?.version || 0,
    }
  }
  function allTenders(org) {
    const profile = getProfile(org)
    const saved = new Map(
      db
        .prepare('SELECT * FROM saved WHERE org_id=? AND source=?')
        .all(org, source)
        .map((r) => [
          r.tender_id,
          {
            stage: r.stage,
            owner: r.owner,
            notes: JSON.parse(r.notes),
            tasks: JSON.parse(r.tasks),
            version: r.version,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          },
        ]),
    )
    return db
      .prepare('SELECT * FROM tenders WHERE source=?')
      .all(source)
      .map((r) => {
        const t = JSON.parse(r.payload)
        return {
          ...t,
          firstSeen: r.first_seen,
          source,
          status: effectiveStatus(t),
          relevance: match(t, profile),
          saved: saved.get(t.id) || null,
        }
      })
  }
  function getTender(id) {
    codeSchema.parse(id)
    const r = db
      .prepare('SELECT payload FROM tenders WHERE id=? AND source=?')
      .get(id, source)
    if (!r) throw fail(404, 'Oportunidad no encontrada.')
    return JSON.parse(r.payload)
  }
  function filtered(req) {
    const input = {}
    for (const key of ['q', 'region', 'buyer', 'status'])
      if (req.query[key] !== undefined) input[key] = req.query[key]
    if (req.query.closingDays !== undefined)
      input.closingDays = Number(req.query.closingDays)
    const filters = filterSchema.parse(input)
    const profile = getProfile(req.user.org_id)
    let list = allTenders(req.user.org_id).filter((t) =>
      accepts(t, filters, req.query.saved === 'true' ? null : profile),
    )
    if (req.query.saved === 'true') list = list.filter((t) => t.saved)
    if (req.query.recommended === 'true')
      list = list.filter((t) => t.relevance.matched.length > 0)
    if (req.query.stage) {
      const stage = z
        .enum([
          'saved',
          'reviewing',
          'preparing',
          'submitted',
          'won',
          'lost',
          'discarded',
        ])
        .parse(req.query.stage)
      list = list.filter((t) => t.saved?.stage === stage)
    }
    const sort = z
      .enum(['relevance', 'closing', 'recent', 'amount'])
      .default('relevance')
      .parse(req.query.sort)
    list.sort((a, b) =>
      sort === 'closing'
        ? (Date.parse(a.closesAt) || Infinity) -
          (Date.parse(b.closesAt) || Infinity)
        : sort === 'recent'
          ? Date.parse(b.publishedAt || b.firstSeen) -
            Date.parse(a.publishedAt || a.firstSeen)
          : sort === 'amount'
            ? (b.amount ?? -1) - (a.amount ?? -1)
            : b.relevance.score - a.relevance.score ||
              (Date.parse(a.closesAt) || Infinity) -
                (Date.parse(b.closesAt) || Infinity),
    )
    return list
  }
  app.get('/api/radar/overview', (req, res) => {
    const list = allTenders(req.user.org_id)
    const open = list.filter((t) => t.status === 'open')
    const syncRun =
      db
        .prepare('SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 1')
        .get() || null
    res.json({
      mode: source,
      configured: config.demo || Boolean(config.ticket),
      profile: getProfile(req.user.org_id),
      sync: syncRun,
      coverage: {
        days: config.syncDays,
        detailLimit: config.detailLimit,
        intervalMinutes: config.syncMinutes,
      },
      stats: {
        total: list.length,
        open: open.length,
        recommended: open.filter(
          (t) => t.relevance.matched.length > 0 && !t.relevance.excluded,
        ).length,
        saved: list.filter((t) => t.saved).length,
        closing: open.filter(
          (t) =>
            t.closesAt && Date.parse(t.closesAt) <= Date.now() + 48 * 3600000,
        ).length,
      },
      regions: [...new Set(list.map((t) => t.region).filter(Boolean))].sort(),
      unread: db
        .prepare(
          'SELECT COUNT(*) AS n FROM notifications WHERE org_id=? AND source=? AND read_at IS NULL',
        )
        .get(req.user.org_id, source).n,
    })
  })
  app.get('/api/radar/tenders', (req, res) => {
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .default(1)
      .parse(req.query.page)
    const list = filtered(req)
    res.json({
      items: list.slice((page - 1) * 24, page * 24),
      total: list.length,
      page,
      pageSize: 24,
    })
  })
  app.get('/api/radar/export.csv', (req, res) =>
    res
      .type('text/csv')
      .set('Content-Disposition', 'attachment; filename="radar-de-pegas.csv"')
      .send(buildCsv(filtered(req))),
  )
  app.get('/api/radar/tenders/:id', (req, res) => {
    getTender(req.params.id)
    res.json(allTenders(req.user.org_id).find((t) => t.id === req.params.id))
  })
  const refreshLimit = rateLimit({
    windowMs: 600000,
    limit: 10,
    keyGenerator: (req) => req.user.org_id,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Límite de consultas alcanzado. Intenta más tarde.' },
  })
  app.post(
    '/api/radar/import',
    refreshLimit,
    asyncRoute(async (req, res) => {
      const { code } = z.object({ code: codeSchema }).strict().parse(req.body)
      if (source === 'demo')
        throw fail(400, 'La demostración solo permite explorar los ejemplos.')
      if (!config.ticket)
        throw fail(
          400,
          'El ticket de Mercado Público todavía no está configurado.',
        )
      try {
        putTender(db, await provider.detail(code), source)
      } catch {
        throw fail(
          502,
          'No se pudo consultar ese código. Verifícalo en Mercado Público e intenta nuevamente.',
        )
      }
      audit(db, req.user, 'tender_imported', code)
      generateNotifications(db, source)
      res.json(allTenders(req.user.org_id).find((t) => t.id === code))
    }),
  )
  app.post(
    '/api/radar/tenders/:id/refresh',
    refreshLimit,
    asyncRoute(async (req, res) => {
      const previous = getTender(req.params.id)
      if (
        source === 'live' &&
        (!previous.detailed ||
          Date.parse(previous.fetchedAt) < Date.now() - 15 * 60000)
      ) {
        try {
          putTender(db, await provider.detail(req.params.id), source)
        } catch {
          throw fail(
            502,
            'No se pudo actualizar desde Mercado Público. Conservamos la versión anterior.',
          )
        }
      }
      generateNotifications(db, source)
      res.json(allTenders(req.user.org_id).find((t) => t.id === req.params.id))
    }),
  )
  app.post('/api/radar/tenders/:id/save', (req, res) => {
    getTender(req.params.id)
    atomic(db, () => {
      const result = db
        .prepare('INSERT OR IGNORE INTO saved VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run(
          req.user.org_id,
          req.params.id,
          source,
          'saved',
          '',
          '[]',
          '[]',
          1,
          now(),
          now(),
        )
      if (result.changes) audit(db, req.user, 'saved', req.params.id)
    })
    generateNotifications(db, source)
    res.json(allTenders(req.user.org_id).find((t) => t.id === req.params.id))
  })
  app.patch('/api/radar/tenders/:id/save', (req, res) => {
    getTender(req.params.id)
    const b = savedSchema.parse(req.body)
    atomic(db, () => {
      const result = db
        .prepare(
          'UPDATE saved SET stage=?,owner=?,tasks=?,version=version+1,updated_at=? WHERE org_id=? AND tender_id=? AND source=? AND version=?',
        )
        .run(
          b.stage,
          b.owner,
          JSON.stringify(b.tasks),
          now(),
          req.user.org_id,
          req.params.id,
          source,
          b.version,
        )
      if (!result.changes)
        throw fail(
          409,
          'El seguimiento cambió en otra sesión. Recarga antes de guardar.',
        )
      audit(db, req.user, 'tracking_updated', req.params.id)
    })
    generateNotifications(db, source)
    res.json(allTenders(req.user.org_id).find((t) => t.id === req.params.id))
  })
  app.post('/api/radar/tenders/:id/notes', (req, res) => {
    getTender(req.params.id)
    const b = noteSchema.parse(req.body)
    atomic(db, () => {
      const row = db
        .prepare(
          'SELECT notes FROM saved WHERE org_id=? AND tender_id=? AND source=?',
        )
        .get(req.user.org_id, req.params.id, source)
      if (!row) throw fail(404, 'Guarda primero esta oportunidad.')
      const notes = JSON.parse(row.notes)
      if (notes.length >= 200)
        throw fail(400, 'Se alcanzó el límite de 200 notas.')
      notes.push({
        id: uid(),
        text: b.text,
        author: req.user.name,
        createdAt: now(),
      })
      db.prepare(
        'UPDATE saved SET notes=?,version=version+1,updated_at=? WHERE org_id=? AND tender_id=? AND source=?',
      ).run(
        JSON.stringify(notes),
        now(),
        req.user.org_id,
        req.params.id,
        source,
      )
      audit(db, req.user, 'note_added', req.params.id)
    })
    res.json(allTenders(req.user.org_id).find((t) => t.id === req.params.id))
  })
  app.delete('/api/radar/tenders/:id/save', (req, res) => {
    codeSchema.parse(req.params.id)
    atomic(db, () => {
      db.prepare(
        'DELETE FROM saved WHERE org_id=? AND tender_id=? AND source=?',
      ).run(req.user.org_id, req.params.id, source)
      audit(db, req.user, 'tracking_removed', req.params.id)
    })
    res.json({ ok: true })
  })
  app.put('/api/radar/profile', (req, res) => {
    const { version, ...body } = z
      .object({ ...profileSchema.shape, version: z.number().int().min(0) })
      .strict()
      .parse(req.body)
    atomic(db, () => {
      const current = getProfile(req.user.org_id)
      if (current.version !== version)
        throw fail(409, 'El perfil cambió. Recarga antes de guardar.')
      db.prepare(
        'INSERT INTO profiles VALUES(?,?,?) ON CONFLICT(org_id) DO UPDATE SET payload=excluded.payload,version=excluded.version',
      ).run(req.user.org_id, JSON.stringify(body), version + 1)
      audit(db, req.user, 'profile_updated', 'profile')
    })
    res.json(getProfile(req.user.org_id))
  })
  app.get('/api/radar/searches', (req, res) =>
    res.json(
      db
        .prepare(
          'SELECT * FROM searches WHERE org_id=? ORDER BY created_at DESC',
        )
        .all(req.user.org_id)
        .map((r) => ({
          id: r.id,
          name: r.name,
          filters: JSON.parse(r.payload),
          enabled: Boolean(r.enabled),
        })),
    ),
  )
  app.post('/api/radar/searches', (req, res) => {
    const b = z
      .object({ name: z.string().trim().min(2).max(80), filters: filterSchema })
      .strict()
      .parse(req.body)
    atomic(db, () => {
      if (
        db
          .prepare('SELECT COUNT(*) n FROM searches WHERE org_id=?')
          .get(req.user.org_id).n >= 20
      )
        throw fail(400, 'Puedes mantener hasta 20 búsquedas.')
      db.prepare('INSERT INTO searches VALUES(?,?,?,?,?,?)').run(
        uid(),
        req.user.org_id,
        b.name,
        JSON.stringify(b.filters),
        1,
        now(),
      )
      audit(db, req.user, 'search_created', b.name)
    })
    generateNotifications(db, source)
    res.status(201).json({ ok: true })
  })
  app.patch('/api/radar/searches/:id', (req, res) => {
    const { enabled } = z
      .object({ enabled: z.boolean() })
      .strict()
      .parse(req.body)
    const result = db
      .prepare('UPDATE searches SET enabled=? WHERE id=? AND org_id=?')
      .run(Number(enabled), req.params.id, req.user.org_id)
    if (!result.changes) throw fail(404, 'Búsqueda no encontrada.')
    res.json({ ok: true })
  })
  app.delete('/api/radar/searches/:id', (req, res) => {
    db.prepare('DELETE FROM searches WHERE id=? AND org_id=?').run(
      req.params.id,
      req.user.org_id,
    )
    res.json({ ok: true })
  })
  app.get('/api/radar/notifications', (req, res) =>
    res.json(
      db
        .prepare(
          'SELECT id,kind,title,tender_id AS tenderId,read_at AS readAt,created_at AS createdAt FROM notifications WHERE org_id=? AND source=? ORDER BY created_at DESC LIMIT 200',
        )
        .all(req.user.org_id, source),
    ),
  )
  app.post('/api/radar/notifications/read', (req, res) => {
    const { id } = z
      .object({ id: z.string().uuid().optional() })
      .strict()
      .parse(req.body)
    if (id)
      db.prepare(
        'UPDATE notifications SET read_at=? WHERE id=? AND org_id=? AND source=?',
      ).run(now(), id, req.user.org_id, source)
    else
      db.prepare(
        'UPDATE notifications SET read_at=? WHERE org_id=? AND source=? AND read_at IS NULL',
      ).run(now(), req.user.org_id, source)
    res.json({ ok: true })
  })
  app.get('/api/radar/audit', (req, res) =>
    res.json(
      db
        .prepare(
          'SELECT a.action,a.resource,a.created_at AS createdAt,u.name AS actor FROM audit a LEFT JOIN users u ON u.id=a.user_id WHERE a.org_id=? ORDER BY a.created_at DESC LIMIT 100',
        )
        .all(req.user.org_id),
    ),
  )
  app.post('/api/radar/sync', (req, res) => {
    if (req.user.role !== 'admin')
      throw fail(403, 'Solo un administrador puede sincronizar.')
    if (!config.demo && !config.ticket)
      throw fail(
        503,
        'Falta configurar el ticket de Mercado Público en el servidor.',
      )
    const recent = db
      .prepare(
        'SELECT started_at FROM sync_runs ORDER BY started_at DESC LIMIT 1',
      )
      .get()
    if (recent && Date.parse(recent.started_at) > Date.now() - 60000)
      throw fail(429, 'Ya se solicitó una sincronización. Espera un minuto.')
    audit(db, req.user, 'sync_requested', 'source')
    void sync().catch(() => {})
    res.status(202).json({ ok: true })
  })
  app.use('/api', (_req, _res, next) => next(fail(404, 'Ruta no encontrada.')))
  app.use((error, req, res, _next) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        error:
          'Revisa los campos: ' +
          error.issues.map((i) => i.path.join('.') || 'datos').join(', '),
      })
    const status = error.status || 500
    res.status(status).json({
      error:
        status >= 500
          ? 'No se pudo completar la operación. Intenta nuevamente.'
          : error.message,
    })
  })
  return app
}
