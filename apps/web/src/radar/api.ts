export type Stage =
  | 'saved'
  | 'reviewing'
  | 'preparing'
  | 'submitted'
  | 'won'
  | 'lost'
  | 'discarded'
export type Task = {
  id: string
  title: string
  done: boolean
  due: string | null
}
export type Tender = {
  id: string
  title: string
  description: string
  status: string
  type: string
  buyer: string
  buyerId: string
  region: string
  commune: string
  closesAt: string | null
  publishedAt: string | null
  questionsUntil: string | null
  answersAt: string | null
  amount: number | null
  currency: string | null
  detailed: boolean
  fetchedAt: string
  firstSeen: string
  source: 'live' | 'demo'
  officialUrl: string | null
  items: {
    name: string
    description: string
    quantity: string
    unit: string
    category: string
  }[]
  relevance: { score: number; matched: string[]; excluded: boolean }
  saved: null | {
    stage: Stage
    owner: string
    notes: { id: string; text: string; author: string; createdAt: string }[]
    tasks: Task[]
    version: number
    createdAt: string
    updatedAt: string
  }
}
export type Profile = {
  name: string
  keywords: string[]
  excludes: string[]
  regions: string[]
  version: number
}
export type Filters = {
  q: string
  region: string
  buyer: string
  status: string
  closingDays: number
}
export type Search = {
  id: string
  name: string
  filters: Filters
  enabled: boolean
}
export type Notification = {
  id: string
  title: string
  kind: string
  tenderId: string | null
  readAt: string | null
  createdAt: string
}
export type Overview = {
  mode: 'demo' | 'live'
  configured: boolean
  profile: Profile
  sync: null | {
    status: string
    count: number
    message: string
    started_at: string
    finished_at: string | null
  }
  coverage: { days: number; detailLimit: number; intervalMinutes: number }
  stats: {
    total: number
    open: number
    recommended: number
    saved: number
    closing: number
  }
  regions: string[]
  unread: number
}
export type User = {
  id: string
  name: string
  email: string
  organization: string
  role: string
  csrf: string
  demo: boolean
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
let csrf = ''
export function setCsrf(value: string) {
  csrf = value
}
export async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(method === 'GET'
          ? {}
          : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
  } catch {
    throw new ApiError(
      0,
      'No se pudo conectar. Revisa tu conexión y vuelve a intentar.',
    )
  }
  const data = await response
    .json()
    .catch(() => ({ error: 'Respuesta no válida del servidor.' }))
  if (!response.ok)
    throw new ApiError(
      response.status,
      data.error || 'No se pudo completar la operación.',
    )
  return data as T
}
export const stageLabels: Record<Stage, string> = {
  saved: 'Guardada',
  reviewing: 'En evaluación',
  preparing: 'Preparando oferta',
  submitted: 'Postulada',
  won: 'Adjudicada',
  lost: 'No adjudicada',
  discarded: 'Descartada',
}
export const statusLabels: Record<string, string> = {
  open: 'Publicada',
  closed: 'Cerrada',
  awarded: 'Adjudicada',
  deserted: 'Desierta',
  revoked: 'Revocada',
  suspended: 'Suspendida',
  unknown: 'Sin informar',
}
export function dateLabel(value: string | null, withTime = false) {
  if (!value) return 'Sin informar'
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'America/Santiago',
  }).format(new Date(value))
}
export function money(t: Tender) {
  if (t.amount === null) return 'Monto no publicado'
  return (
    new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(
      t.amount,
    ) +
    ' ' +
    (t.currency || 'moneda sin informar')
  )
}
export function closingLabel(t: Tender) {
  if (!t.closesAt) return 'Cierre sin informar'
  const h = (Date.parse(t.closesAt) - Date.now()) / 3600000
  if (h <= 0) return 'Plazo finalizado'
  if (h < 24) return `Cierra en ${Math.max(1, Math.ceil(h))} h`
  return `Cierra en ${Math.ceil(h / 24)} días`
}
export const defaultFilters = (): Filters => ({
  q: '',
  region: '',
  buyer: '',
  status: 'open',
  closingDays: 0,
})
