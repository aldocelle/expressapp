import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

export const uid = () => randomUUID()
export const now = () => new Date().toISOString()
export function openDb(path) {
  if (path !== ':memory:')
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(path)
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS organizations(id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','member')));
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS profiles(org_id TEXT PRIMARY KEY REFERENCES organizations(id), payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS tenders(id TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('demo','live')), payload TEXT NOT NULL, first_seen TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(id,source));
    CREATE TABLE IF NOT EXISTS saved(org_id TEXT NOT NULL REFERENCES organizations(id), tender_id TEXT NOT NULL, source TEXT NOT NULL, stage TEXT NOT NULL, owner TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '[]', tasks TEXT NOT NULL DEFAULT '[]', version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(org_id,tender_id,source), FOREIGN KEY(tender_id,source) REFERENCES tenders(id,source));
    CREATE TABLE IF NOT EXISTS searches(id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), name TEXT NOT NULL, payload TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), kind TEXT NOT NULL, title TEXT NOT NULL, tender_id TEXT, source TEXT NOT NULL, dedup_key TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL, UNIQUE(org_id,dedup_key));
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), user_id TEXT, action TEXT NOT NULL, resource TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sync_runs(id TEXT PRIMARY KEY, status TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, message TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT);
    CREATE TABLE IF NOT EXISTS locks(name TEXT PRIMARY KEY, expires_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS notifications_org ON notifications(org_id,created_at);
    CREATE INDEX IF NOT EXISTS audit_org ON audit(org_id,created_at);
    INSERT OR IGNORE INTO schema_version VALUES(1);`)
  return db
}

export function atomic(db, fn) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
export function audit(db, user, action, resource) {
  db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').run(
    uid(),
    user.org_id,
    user.id,
    action,
    resource,
    now(),
  )
}
export function putTender(db, t, source) {
  const stamp = now()
  db.prepare(
    `INSERT INTO tenders VALUES(?,?,?,?,?) ON CONFLICT(id,source) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`,
  ).run(t.id, source, JSON.stringify(t), stamp, stamp)
}
