import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
const root = fileURLToPath(new URL('../../../', import.meta.url))
export function readConfig(env = process.env) {
  const production = env.NODE_ENV === 'production'
  const origin = env.APP_ORIGIN || 'http://localhost:5173'
  const parsed = new URL(origin)
  if (parsed.origin !== origin || (production && parsed.protocol !== 'https:'))
    throw new Error(
      'APP_ORIGIN debe ser un origen exacto; HTTPS en producción.',
    )
  const number = (name, fallback, min, max) => {
    const n = Number(env[name] ?? fallback)
    if (!Number.isInteger(n) || n < min || n > max)
      throw new Error(`Configuración inválida: ${name}`)
    return n
  }
  return {
    production,
    origin,
    demo: env.RADAR_DEMO === 'true',
    ticket: env.MERCADO_PUBLICO_TICKET || '',
    dbPath: resolve(env.RADAR_DB_PATH || resolve(root, 'data/radar.sqlite')),
    port: number('PORT', 3001, 1, 65535),
    host: env.HOST || '127.0.0.1',
    trustProxy: number('TRUST_PROXY_HOPS', 0, 0, 3),
    syncDays: number('RADAR_SYNC_DAYS', 3, 1, 7),
    detailLimit: number('RADAR_DETAIL_LIMIT', 30, 0, 100),
    syncMinutes: number('RADAR_SYNC_MINUTES', 30, 5, 1440),
    webPath: resolve(root, 'apps/web/dist'),
  }
}
