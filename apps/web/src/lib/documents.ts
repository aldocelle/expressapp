export type DocumentCategory = 'Contrato' | 'Permiso' | 'Seguro' | 'Certificado' | 'Otro'
export type DocumentStatus = 'vigente' | 'por-vencer' | 'vencido'

export type VenceDocument = {
  id: string
  name: string
  category: DocumentCategory
  owner: string
  expiresOn: string
  notes: string
  createdAt: string
}

const STORAGE_KEY = 'expressapps.venceya.documents.v1'

function isoDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

export function dayDifference(expiresOn: string, today = new Date()): number {
  const parts = expiresOn.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return Number.NaN
  const [year, month, day] = parts
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) return Number.NaN
  return Math.round((Date.UTC(year, month - 1, day) - isoDay(today)) / 86400000)
}

export function getDocumentStatus(expiresOn: string, today = new Date(), horizon = 30): DocumentStatus {
  const remaining = dayDifference(expiresOn, today)
  if (!Number.isFinite(remaining)) return 'vencido'
  if (remaining < 0) return 'vencido'
  if (remaining <= horizon) return 'por-vencer'
  return 'vigente'
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return year && month && day ? day + '/' + month + '/' + year : iso
}

export function readDocuments(): VenceDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is VenceDocument =>
      !!item && typeof item === 'object' &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.category === 'string' &&
      typeof item.owner === 'string' &&
      typeof item.expiresOn === 'string' &&
      typeof item.notes === 'string'
    )
  } catch {
    return []
  }
}

export function writeDocuments(documents: VenceDocument[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(documents))
}

function csvValue(input: string): string {
  // Prefix potentially executable spreadsheet formulas when exported.
  const sanitized = /^[\s]*[=+\-@]/.test(input) ? "'" + input : input
  return '"' + sanitized.replaceAll('"', '""') + '"'
}

export function documentsToCsv(documents: VenceDocument[]): string {
  const header = ['Nombre', 'Categoría', 'Responsable', 'Vencimiento', 'Estado', 'Notas']
  const rows = documents.map((doc) => [
    doc.name, doc.category, doc.owner, doc.expiresOn, getDocumentStatus(doc.expiresOn), doc.notes
  ])
  return '\uFEFF' + [header, ...rows].map(row => row.map(csvValue).join(';')).join('\r\n')
}

export function exportDocumentsCsv(documents: VenceDocument[]): void {
  const blob = new Blob([documentsToCsv(documents)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'venceya-vencimientos.csv'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
