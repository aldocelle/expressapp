import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
const dir = mkdtempSync(resolve(tmpdir(), 'radar-e2e-'))
const env = {
  ...process.env,
  PORT: '3199',
  HOST: '127.0.0.1',
  APP_ORIGIN: 'http://127.0.0.1:3199',
  RADAR_DB_PATH: resolve(dir, 'db.sqlite'),
  RADAR_DEMO: 'true',
  RADAR_USER_EMAIL: 'demo@example.test',
  RADAR_USER_PASSWORD: 'test-only-password-1234',
  RADAR_USER_NAME: 'Equipo Demo',
  RADAR_ORG_NAME: 'ExpressWebsite',
}
for (const project of ['desktop', 'mobile'])
  execFileSync(process.execPath, ['apps/api/src/cli.mjs', 'user'], {
    env: {
      ...env,
      RADAR_USER_EMAIL: `${project}@example.test`,
      RADAR_ORG_NAME: `ExpressWebsite ${project}`,
    },
    stdio: 'inherit',
  })
const child = spawn(process.execPath, ['apps/api/src/server.mjs'], {
  env,
  stdio: 'inherit',
})
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal))
child.on('exit', (code) => {
  rmSync(dir, { recursive: true, force: true })
  process.exit(code || 0)
})
