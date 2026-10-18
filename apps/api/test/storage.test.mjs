import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { openDb, uid, now } from '../src/db.mjs'
import { seedDemo } from '../src/demo.mjs'
import { generateNotifications } from '../src/jobs.mjs'

test('records persist after reopen and the backup can be restored independently', () => {
  const dir = mkdtempSync(join(tmpdir(), 'radar-storage-'))
  try {
    const path = join(dir, 'main.sqlite'),
      backup = join(dir, 'backup.sqlite')
    let db = openDb(path)
    seedDemo(db)
    db.prepare('INSERT INTO organizations VALUES(?,?)').run('test', 'Test')
    db.prepare('INSERT INTO saved VALUES(?,?,?,?,?,?,?,?,?,?)').run(
      'test',
      'DEMO-1',
      'demo',
      'preparing',
      'Owner',
      '[]',
      '[]',
      1,
      now(),
      now(),
    )
    db.close()
    db = openDb(path)
    assert.equal(db.prepare('SELECT stage FROM saved').get().stage, 'preparing')
    db.close()
    execFileSync(process.execPath, ['src/cli.mjs', 'backup'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, RADAR_DB_PATH: path, RADAR_BACKUP_PATH: backup },
      stdio: 'pipe',
    })
    const restored = openDb(backup)
    assert.equal(
      restored.prepare('PRAGMA integrity_check').get().integrity_check,
      'ok',
    )
    assert.equal(
      restored.prepare('SELECT owner FROM saved').get().owner,
      'Owner',
    )
    restored.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('due tasks and closing reminders are deduplicated and only target the tracking organization', () => {
  const db = openDb(':memory:')
  seedDemo(db)
  db.prepare('INSERT INTO organizations VALUES(?,?)').run('org', 'Org')
  const tasks = [
    { id: uid(), title: 'Tarea vencida', due: '2020-01-01', done: false },
    { id: uid(), title: 'Completada', due: '2020-01-01', done: true },
  ]
  db.prepare('INSERT INTO saved VALUES(?,?,?,?,?,?,?,?,?,?)').run(
    'org',
    'DEMO-3',
    'demo',
    'preparing',
    '',
    '[]',
    JSON.stringify(tasks),
    1,
    now(),
    now(),
  )
  generateNotifications(db, 'demo')
  generateNotifications(db, 'demo')
  const rows = db.prepare('SELECT * FROM notifications').all()
  assert.equal(rows.length, 2)
  assert.ok(rows.every((r) => r.org_id === 'org'))
  db.close()
})
