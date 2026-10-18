import express from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { readConfig } from './config.mjs'
import { openDb } from './db.mjs'
import { seedDemo } from './demo.mjs'
import { createProvider } from './provider.mjs'
import { createSync, generateNotifications } from './jobs.mjs'
import { createApp } from './app.mjs'

const config = readConfig()
process.umask(0o077)
const db = openDb(config.dbPath)
if (config.demo) seedDemo(db)
const provider = createProvider(config.ticket)
const sync = createSync(db, provider, {
  source: config.demo ? 'demo' : 'live',
  days: config.syncDays,
  detailLimit: config.detailLimit,
})
const app = await createApp({ db, provider, sync, config })
if (existsSync(config.webPath)) {
  app.use(express.static(config.webPath, { index: false, maxAge: '1h' }))
  app.get('/{*path}', (_req, res) =>
    res
      .set('Cache-Control', 'no-cache')
      .sendFile(resolve(config.webPath, 'index.html')),
  )
}
const server = app.listen(config.port, config.host, () =>
  console.log(
    `Radar API disponible en ${config.host}:${config.port} (${config.demo ? 'demo' : 'live'})`,
  ),
)
server.requestTimeout = 30000
server.headersTimeout = 15000
const timer = setInterval(
  () => void sync().catch(() => {}),
  config.syncMinutes * 60000,
)
const reminder = setInterval(() => {
  try {
    generateNotifications(db, config.demo ? 'demo' : 'live')
  } catch {
    console.error('No se pudieron evaluar recordatorios.')
  }
}, 60000)
timer.unref()
reminder.unref()
let shuttingDown = false
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    if (shuttingDown) return
    shuttingDown = true
    clearInterval(timer)
    clearInterval(reminder)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 25000).unref()
  })
