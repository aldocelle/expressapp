import { DateTime } from 'luxon'
import { uid, now, atomic, putTender } from './db.mjs'
import { accepts, match, effectiveStatus } from './domain.mjs'

export function generateNotifications(db, source) {
  const all = db
    .prepare('SELECT payload FROM tenders WHERE source=?')
    .all(source)
    .map((row) => JSON.parse(row.payload))
  const insert = db.prepare(
    'INSERT OR IGNORE INTO notifications VALUES(?,?,?,?,?,?,?,?,?)',
  )
  function notify(org, kind, title, tender, key) {
    insert.run(
      uid(),
      org,
      kind,
      title,
      tender,
      source,
      `${source}:${key}`,
      null,
      now(),
    )
  }
  atomic(db, () => {
    for (const search of db
      .prepare('SELECT * FROM searches WHERE enabled=1')
      .all()) {
      const f = JSON.parse(search.payload)
      for (const t of all)
        if (accepts(t, f, null))
          notify(
            search.org_id,
            'match',
            `${search.name}: ${t.title}`,
            t.id,
            `search:${search.id}:${t.id}`,
          )
    }
    for (const row of db
      .prepare('SELECT * FROM saved WHERE source=?')
      .all(source)) {
      if (['won', 'lost', 'discarded'].includes(row.stage)) continue
      const t = all.find((t) => t.id === row.tender_id)
      if (!t) continue
      const hours = (Date.parse(t.closesAt) - Date.now()) / 3600000
      if (effectiveStatus(t) === 'open' && hours > 0 && hours <= 48)
        notify(
          row.org_id,
          'deadline',
          `Cierra en menos de 48 horas: ${t.title}`,
          t.id,
          `closing:${t.id}:${t.closesAt}`,
        )
      const today = DateTime.now().setZone('America/Santiago').toISODate()
      for (const task of JSON.parse(row.tasks))
        if (!task.done && task.due && task.due <= today)
          notify(
            row.org_id,
            'task',
            `Tarea pendiente: ${task.title}`,
            t.id,
            `task:${task.id}:${task.due}`,
          )
    }
  })
}

export function createSync(
  db,
  provider,
  { source = 'live', days = 3, detailLimit = 30 } = {},
) {
  let running = false
  return async function sync() {
    if (running) return false
    const acquired = atomic(db, () => {
      db.prepare('DELETE FROM locks WHERE name=? AND expires_at<?').run(
        'sync',
        now(),
      )
      return (
        db
          .prepare('INSERT OR IGNORE INTO locks VALUES(?,?)')
          .run('sync', new Date(Date.now() + 3600000).toISOString()).changes > 0
      )
    })
    if (!acquired) return false
    running = true
    const id = uid()
    db.prepare('INSERT INTO sync_runs VALUES(?,?,?,?,?,?)').run(
      id,
      'running',
      0,
      'Sincronización en curso',
      now(),
      null,
    )
    try {
      if (source === 'demo') {
        generateNotifications(db, source)
        db.prepare(
          'UPDATE sync_runs SET status=?,message=?,finished_at=? WHERE id=?',
        ).run(
          'success',
          'Ejemplos revisados; no se consultó Mercado Público',
          now(),
          id,
        )
        return true
      }
      const incoming = new Map()
      for (let i = 0; i < days; i++) {
        const date = DateTime.now()
          .setZone('America/Santiago')
          .minus({ days: i })
          .toFormat('ddMMyyyy')
        for (const t of await provider.list(date)) incoming.set(t.id, t)
      }
      atomic(db, () => {
        for (const t of incoming.values()) {
          const existing = db
            .prepare('SELECT payload FROM tenders WHERE id=? AND source=?')
            .get(t.id, source)
          const previous = existing ? JSON.parse(existing.payload) : null
          // Summary responses must not erase richer fields obtained from detail.
          putTender(
            db,
            previous?.detailed
              ? {
                  ...previous,
                  title: t.title,
                  status: t.status,
                  closesAt: t.closesAt,
                  summaryFetchedAt: t.fetchedAt,
                }
              : t,
            source,
          )
        }
      })
      // Refresh oldest tracked records first; then enrich recent summaries. Bounded API budget.
      const tracked = db
        .prepare(
          `SELECT DISTINCT t.id,json_extract(t.payload,'$.fetchedAt') AS fetched FROM tenders t JOIN saved s ON s.tender_id=t.id AND s.source=t.source WHERE t.source=? AND s.stage NOT IN ('won','lost','discarded') AND (json_extract(t.payload,'$.fetchedAt') IS NULL OR json_extract(t.payload,'$.fetchedAt')<?) ORDER BY fetched LIMIT ?`,
        )
        .all(
          source,
          new Date(Date.now() - 6 * 3600000).toISOString(),
          detailLimit,
        )
      const enrichment = db
        .prepare(
          `SELECT id FROM tenders WHERE source=? ORDER BY COALESCE(json_extract(payload,'$.detailed'),0),json_extract(payload,'$.fetchedAt') LIMIT ?`,
        )
        .all(source, detailLimit)
      const candidates = [
        ...new Set([
          ...tracked.map((t) => t.id),
          ...enrichment.map((t) => t.id),
        ]),
      ].slice(0, detailLimit)
      let detailFailures = 0
      for (const code of candidates) {
        try {
          putTender(db, await provider.detail(code), source)
        } catch (error) {
          if (error.code === 'UPSTREAM_RATE_LIMIT') throw error
          detailFailures++
        }
      }
      generateNotifications(db, source)
      db.prepare(
        'UPDATE sync_runs SET status=?,count=?,message=?,finished_at=? WHERE id=?',
      ).run(
        detailFailures ? 'partial' : 'success',
        incoming.size,
        `${incoming.size} resúmenes; ${candidates.length - detailFailures} detalles actualizados${detailFailures ? `; ${detailFailures} detalles pendientes` : ''}`,
        now(),
        id,
      )
      return true
    } catch (error) {
      const message =
        error.code === 'MISSING_TICKET'
          ? 'Configura el ticket de Mercado Público en el servidor.'
          : 'La fuente no respondió correctamente. Se conserva la información anterior.'
      db.prepare(
        'UPDATE sync_runs SET status=?,message=?,finished_at=? WHERE id=?',
      ).run('error', message, now(), id)
      return false
    } finally {
      running = false
      db.prepare('DELETE FROM locks WHERE name=?').run('sync')
    }
  }
}
