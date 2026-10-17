export type Cadence = 'monthly' | 'quarterly' | 'semiannual' | 'annual'
export type ContractState = 'active' | 'paused' | 'cancelled'
export type RenewalRecord = { id: string; at: string; previousDate: string; nextDate: string }
export type Contract = {
  id: string; customer: string; service: string; amount: number
  startsOn: string; nextOn: string; cadence: Cadence; state: ContractState
  anchorDay: number; monthEnd: boolean; note: string; createdAt: string; history: RenewalRecord[]
}
export type RenewalStore = { version: 1; contracts: Contract[] }
export type RenewalStatus = 'active' | 'due-soon' | 'overdue' | 'paused' | 'cancelled'
export const emptyRenewals = (): RenewalStore => ({ version: 1, contracts: [] })
const STORAGE = 'expressapps.renuevapro.v1'
const maxAmount = 999_999_999_999
const cadenceMonths: Record<Cadence, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }
export const cadences: Cadence[] = ['monthly', 'quarterly', 'semiannual', 'annual']
export const cadenceLabel: Record<Cadence, string> = {
  monthly: 'Mensual', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual'
}
const moneyFormat = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
export const money = (value: number) => moneyFormat.format(value)
export const validAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= maxAmount

export function parseDay(value: string): { y: number; m: number; d: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  if (y < 1900 || y > 9998 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}
export function relativeDays(iso: string, today = new Date()): number {
  const parts = parseDay(iso)
  if (!parts) return Number.NaN
  return Math.round((
    Date.UTC(parts.y, parts.m - 1, parts.d) -
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  ) / 86_400_000)
}
export const isoLocal = (value = new Date()): string =>
  [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0')].join('-')
export const prettyDate = (value: string): string =>
  parseDay(value) ? value.split('-').reverse().join('/') : 'Fecha inválida'

/** Maintains original anchor: 30 Jan -> 28 Feb -> 30 Mar; 31 Jan -> last day of each month. */
export function nextDate(current: string, cadence: Cadence, anchorDay: number, monthEnd: boolean): string {
  const p = parseDay(current)
  if (!p) throw new Error('La fecha de renovación no es válida.')
  const monthCount = (p.y * 12 + p.m - 1) + cadenceMonths[cadence]
  const y = Math.floor(monthCount / 12)
  const m = monthCount % 12 + 1
  if (y > 9998) throw new Error('La fecha de renovación supera el rango permitido.')
  const d = monthEnd ? daysInMonth(y, m) : Math.min(anchorDay, daysInMonth(y, m))
  return [y, String(m).padStart(2, '0'), String(d).padStart(2, '0')].join('-')
}
export function newContract(data: Pick<Contract,'customer'|'service'|'amount'|'startsOn'|'nextOn'|'cadence'|'note'>): Contract {
  const p = parseDay(data.nextOn)
  if (!p) throw new Error('Selecciona una fecha válida.')
  return { ...data, id: crypto.randomUUID(), state: 'active',
    anchorDay: p.d, monthEnd: p.d === daysInMonth(p.y, p.m),
    history: [], createdAt: new Date().toISOString() }
}
export function validateContract(input: Pick<Contract,'customer'|'service'|'amount'|'startsOn'|'nextOn'|'cadence'>): string | null {
  if (input.customer.trim().length < 2) return 'Ingresa el nombre del cliente.'
  if (input.service.trim().length < 2) return 'Ingresa el servicio contratado.'
  if (!validAmount(input.amount)) return 'Ingresa un precio entero y positivo en pesos.'
  if (!cadences.includes(input.cadence)) return 'Selecciona una periodicidad válida.'
  if (!parseDay(input.startsOn) || !parseDay(input.nextOn)) return 'Las fechas no son válidas.'
  if (input.nextOn < input.startsOn) return 'La renovación no puede ser anterior al inicio.'
  return null
}
export function renewalStatus(record: Contract, today = new Date()): RenewalStatus {
  if (record.state === 'cancelled') return 'cancelled'
  if (record.state === 'paused') return 'paused'
  const remaining = relativeDays(record.nextOn, today)
  if (remaining < 0) return 'overdue'
  if (remaining <= 30) return 'due-soon'
  return 'active'
}
export function renew(record: Contract, at = isoLocal()): Contract {
  if (record.state !== 'active') throw new Error('Solo se pueden renovar servicios activos.')
  if (!parseDay(at)) throw new Error('Fecha de operación inválida.')
  const target = nextDate(record.nextOn, record.cadence, record.anchorDay, record.monthEnd)
  if (target <= record.nextOn) throw new Error('La fecha de renovación no avanzó.')
  return { ...record, nextOn: target,
    history: [...record.history, { id: crypto.randomUUID(), at, previousDate: record.nextOn, nextDate: target }] }
}
export function equivalentMRR(contracts: Contract[]): number {
  return contracts.filter(c => c.state === 'active')
    .reduce((total, c) => total + c.amount / cadenceMonths[c.cadence], 0)
}
export function summary(contracts: Contract[], today = new Date()) {
  const active = contracts.filter(c => c.state === 'active')
  return {
    active: active.length,
    soon: active.filter(c => renewalStatus(c,today) === 'due-soon').length,
    overdue: active.filter(c => renewalStatus(c,today) === 'overdue').length,
    mrr: equivalentMRR(contracts),
    dueAmount: active.filter(c => relativeDays(c.nextOn,today) <= 30)
      .reduce((total,c) => total + c.amount,0)
  }
}
const object = (v: unknown): v is Record<string,unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const validHistory = (v: unknown) => object(v) && typeof v.id === 'string' &&
  typeof v.at === 'string' && !!parseDay(v.at) && typeof v.previousDate === 'string' &&
  !!parseDay(v.previousDate) && typeof v.nextDate === 'string' && !!parseDay(v.nextDate)
export function validStore(value: unknown): value is RenewalStore {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.contracts)) return false
  const contracts = value.contracts as unknown[]
  if (!contracts.every(c => object(c) &&
    typeof c.id === 'string' && typeof c.customer === 'string' &&
    typeof c.service === 'string' && validAmount(c.amount) &&
    typeof c.startsOn === 'string' && !!parseDay(c.startsOn) &&
    typeof c.nextOn === 'string' && !!parseDay(c.nextOn) &&
    typeof c.cadence === 'string' && cadences.includes(c.cadence as Cadence) &&
    (c.state === 'active' || c.state === 'paused' || c.state === 'cancelled') &&
    Number.isInteger(c.anchorDay) && (c.anchorDay as number) >= 1 && (c.anchorDay as number) <= 31 &&
    typeof c.monthEnd === 'boolean' && typeof c.note === 'string' &&
    typeof c.createdAt === 'string' && Array.isArray(c.history) && c.history.every(validHistory)
  )) return false
  return new Set(contracts.map(c=>(c as Contract).id)).size === contracts.length
}
export function readRenewals(): RenewalStore {
  const raw = localStorage.getItem(STORAGE)
  if (!raw) return emptyRenewals()
  let result: unknown
  try { result = JSON.parse(raw) } catch { throw new Error('Los registros locales están dañados.') }
  if (!validStore(result)) throw new Error('El formato local no es válido. Se bloqueó la escritura para no sobrescribir registros.')
  return result
}
export function saveRenewals(value: RenewalStore): void {
  if (!validStore(value)) throw new Error('Los registros no cumplen las validaciones.')
  localStorage.setItem(STORAGE, JSON.stringify(value))
}
export function csvCell(value: string | number) {
  const safe = /^[\s]*[=+\-@\t\r]/.test(String(value)) ? "'" + value : String(value)
  return '"' + safe.replaceAll('"','""') + '"'
}
export function renewalCsv(value: RenewalStore, today = new Date()): string {
  const rows: (string|number)[][] = [['Cliente','Servicio','Monto CLP','Frecuencia','Inicio','Próxima renovación','Estado','Renovaciones','Notas']]
  for(const c of value.contracts) rows.push([c.customer,c.service,c.amount,cadenceLabel[c.cadence],c.startsOn,c.nextOn,renewalStatus(c,today),c.history.length,c.note])
  return '\uFEFF' + rows.map(row=>row.map(csvCell).join(';')).join('\r\n')
}
export function exportCsv(csv: string): void {
  const url=URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}))
  const a=document.createElement('a'); a.href=url;a.download='renuevapro-servicios.csv'
  document.body.appendChild(a);a.click();a.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}
