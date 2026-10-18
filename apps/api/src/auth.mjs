import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from 'node:crypto'
import { promisify } from 'node:util'
const scrypt = promisify(scryptCallback)
export const token = () => randomBytes(32).toString('hex')
export const digest = (v) => createHash('sha256').update(v).digest('hex')
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })
  return `${salt}:${hash.toString('hex')}`
}
export async function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':')
  const hash = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })
  const buffer = Buffer.from(expected, 'hex')
  return hash.length === buffer.length && timingSafeEqual(hash, buffer)
}
export const sessionCookie = (value, production, clear = false) =>
  `radar_session=${value}; HttpOnly; SameSite=Lax; Path=/; ${production ? 'Secure; ' : ''}Max-Age=${clear ? 0 : 43200}`
export function getSessionToken(req) {
  const cookie = (req.headers.cookie || '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('radar_session='))
  const value = cookie?.slice(14)
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null
}
