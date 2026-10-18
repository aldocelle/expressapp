import { DateTime } from 'luxon'
import { z } from 'zod'

export const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
export const stages = [
  'saved',
  'reviewing',
  'preparing',
  'submitted',
  'won',
  'lost',
  'discarded',
]
const terms = z
  .array(z.string().trim().min(2).max(80))
  .max(30)
  .transform((values) => [
    ...new Map(values.map((value) => [normalizeText(value), value])).values(),
  ])
export const filterSchema = z
  .object({
    q: z.string().trim().max(200).default(''),
    region: z.string().trim().max(120).default(''),
    buyer: z.string().trim().max(160).default(''),
    status: z
      .enum(['all', 'open', 'closed', 'awarded', 'deserted'])
      .default('open'),
    closingDays: z.number().int().min(0).max(365).default(0),
  })
  .strict()
export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    keywords: terms,
    excludes: terms,
    regions: z.array(z.string().max(120)).max(16),
  })
  .strict()
export const noteSchema = z
  .object({ text: z.string().trim().min(1).max(4000) })
  .strict()
export const taskSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    done: z.boolean(),
    due: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => DateTime.fromISO(value).isValid)
      .nullable(),
  })
  .strict()
export const savedSchema = z
  .object({
    version: z.number().int().positive(),
    stage: z.enum(stages),
    owner: z.string().trim().max(120),
    tasks: z.array(taskSchema).max(100),
  })
  .strict()
export const parseDate = (value) => {
  if (!value) return null
  const date = DateTime.fromISO(String(value), { zone: 'America/Santiago' })
  return date.isValid ? date.toUTC().toISO() : null
}
const clean = (value, max = 20000) =>
  String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
const states = {
  5: 'open',
  6: 'closed',
  7: 'deserted',
  8: 'awarded',
  18: 'revoked',
  19: 'suspended',
}
export function normalizeTender(raw, detailed = false) {
  const id = clean(raw.CodigoExterno, 80)
  if (!/^[\w-]{3,80}$/.test(id) || !clean(raw.Nombre))
    throw new Error('INVALID_TENDER')
  const dates = raw.Fechas || {}
  const buyer = raw.Comprador || {}
  const amount = Number(raw.MontoEstimado)
  return {
    id,
    title: clean(raw.Nombre, 1000),
    description: clean(raw.Descripcion),
    status: states[Number(raw.CodigoEstado)] || 'unknown',
    type: clean(raw.Tipo, 50),
    buyer: clean(buyer.NombreOrganismo || buyer.NombreUnidad, 300),
    buyerId: clean(buyer.CodigoOrganismo, 80),
    region: clean(buyer.RegionUnidad, 120),
    commune: clean(buyer.ComunaUnidad, 120),
    closesAt: parseDate(raw.FechaCierre || dates.FechaCierre),
    publishedAt: parseDate(dates.FechaPublicacion),
    questionsUntil: parseDate(dates.FechaFinalPreguntas),
    answersAt: parseDate(dates.FechaPublicacionRespuestas),
    amount:
      detailed &&
      Number.isFinite(amount) &&
      amount > 0 &&
      Number(raw.VisibilidadMonto) !== 0
        ? amount
        : null,
    currency: clean(raw.Moneda, 20) || null,
    items:
      detailed && Array.isArray(raw.Items?.Listado)
        ? raw.Items.Listado.slice(0, 200).map((i) => ({
            name: clean(i.NombreProducto, 500),
            description: clean(i.Descripcion, 2000),
            quantity: clean(i.Cantidad, 30),
            unit: clean(i.UnidadMedida, 80),
            category: clean(i.Categoria, 500),
          }))
        : [],
    detailed,
    fetchedAt: new Date().toISOString(),
    officialUrl: `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=&idlicitacion=${encodeURIComponent(id)}`,
  }
}
export function effectiveStatus(t, at = Date.now()) {
  return t.status === 'open' && t.closesAt && Date.parse(t.closesAt) <= at
    ? 'closed'
    : t.status
}
export function match(t, profile) {
  if (!profile) return { score: 0, matched: [], excluded: false }
  const text = normalizeText(
    [
      t.title,
      t.description,
      ...(t.items || []).map((i) => `${i.name} ${i.description} ${i.category}`),
    ].join(' '),
  )
  const excluded = profile.excludes.some((term) =>
    text.includes(normalizeText(term)),
  )
  const matched = profile.keywords.filter((term) =>
    text.includes(normalizeText(term)),
  )
  const regionMatch =
    profile.regions.length &&
    profile.regions.some((r) => normalizeText(r) === normalizeText(t.region))
  // A relevance score, never a probability of eligibility or award.
  return {
    score: excluded
      ? 0
      : Math.min(100, matched.length * 25 + (regionMatch ? 10 : 0)),
    matched,
    excluded,
  }
}
export function accepts(t, filters, profile, at = Date.now()) {
  if (profile && match(t, profile).excluded) return false
  const haystack = normalizeText(
    [
      t.id,
      t.title,
      t.description,
      t.buyer,
      ...(t.items || []).map((i) => `${i.name} ${i.description}`),
    ].join(' '),
  )
  if (
    filters.q &&
    !normalizeText(filters.q)
      .split(/\s+/)
      .every((w) => haystack.includes(w))
  )
    return false
  if (
    filters.region &&
    normalizeText(t.region) !== normalizeText(filters.region)
  )
    return false
  if (
    filters.buyer &&
    !normalizeText(t.buyer).includes(normalizeText(filters.buyer))
  )
    return false
  if (filters.status !== 'all' && effectiveStatus(t, at) !== filters.status)
    return false
  if (
    filters.closingDays &&
    (!t.closesAt ||
      Date.parse(t.closesAt) <= at ||
      Date.parse(t.closesAt) > at + filters.closingDays * 86400000)
  )
    return false
  return true
}
export function csvCell(value) {
  const text = String(value ?? '')
  return `"${(/^[\s\u0000-\u0020]*[=+@-]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`
}
export function buildCsv(rows) {
  return (
    '\ufeff' +
    [
      [
        'Código',
        'Oportunidad',
        'Organismo',
        'Región',
        'Cierre UTC',
        'Estado',
        'Monto publicado',
        'Moneda',
        'Seguimiento',
      ],
      ...rows.map((t) => [
        t.id,
        t.title,
        t.buyer,
        t.region,
        t.closesAt,
        effectiveStatus(t),
        t.amount,
        t.currency,
        t.saved?.stage,
      ]),
    ]
      .map((row) => row.map(csvCell).join(';'))
      .join('\r\n')
  )
}
