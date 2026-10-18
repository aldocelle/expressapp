import { readConfig } from './config.mjs'
import { openDb, uid, atomic } from './db.mjs'
import { hashPassword } from './auth.mjs'
import { seedDemo } from './demo.mjs'
import { createProvider } from './provider.mjs'
import { createSync } from './jobs.mjs'
import { mkdirSync, chmodSync } from 'node:fs'
import { dirname, isAbsolute } from 'node:path'

process.umask(0o077)
const config = readConfig()
const db = openDb(config.dbPath)
if (process.argv[2] === 'user') {
  const email = process.env.RADAR_USER_EMAIL?.trim().toLowerCase()
  const password = process.env.RADAR_USER_PASSWORD
  const name = process.env.RADAR_USER_NAME?.trim()
  const orgName = process.env.RADAR_ORG_NAME?.trim()
  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !name ||
    !orgName ||
    !password ||
    password.length < 14 ||
    password.length > 256
  )
    throw new Error(
      'Define RADAR_USER_EMAIL, RADAR_USER_NAME, RADAR_ORG_NAME y RADAR_USER_PASSWORD (14–256 caracteres).',
    )
  const hash = await hashPassword(password)
  atomic(db, () => {
    let org = db
      .prepare('SELECT id FROM organizations WHERE name=?')
      .get(orgName)
    if (!org) {
      org = { id: uid() }
      db.prepare('INSERT INTO organizations VALUES(?,?)').run(org.id, orgName)
    }
    const old = db
      .prepare('SELECT id,org_id FROM users WHERE email=?')
      .get(email)
    if (old && old.org_id !== org.id)
      throw new Error('El usuario pertenece a otra organización.')
    if (old) {
      db.prepare('UPDATE users SET password=?,name=? WHERE id=?').run(
        hash,
        name,
        old.id,
      )
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(old.id)
    } else
      db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(
        uid(),
        org.id,
        email,
        name,
        hash,
        'admin',
      )
  })
  if (config.demo) seedDemo(db)
  console.log(
    'Usuario configurado; las sesiones anteriores fueron revocadas. No se ha mostrado la contraseña.',
  )
} else if (process.argv[2] === 'sync') {
  const sync = createSync(db, createProvider(config.ticket), {
    source: config.demo ? 'demo' : 'live',
    days: config.syncDays,
    detailLimit: config.detailLimit,
  })
  if (!(await sync())) process.exitCode = 1
  console.log('Revisa el resultado en la aplicación.')
} else if (process.argv[2] === 'backup') {
  const target = process.env.RADAR_BACKUP_PATH
  if (!target || !isAbsolute(target))
    throw new Error('Define RADAR_BACKUP_PATH con una ruta absoluta nueva.')
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 })
  db.prepare('VACUUM INTO ?').run(target)
  chmodSync(target, 0o600)
  const backup = openDb(target)
  if (backup.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok')
    throw new Error('El respaldo no pasó la comprobación de integridad.')
  backup.close()
  console.log('Respaldo creado y comprobado.')
} else throw new Error('Comando no reconocido.')
db.close()
