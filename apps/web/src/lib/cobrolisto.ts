export type Customer = {
  id: string
  name: string
  email: string
  phone: string
  createdAt: string
}

export type Payment = {
  id: string
  amount: number
  date: string
  note: string
  createdAt: string
}

export type Receivable = {
  id: string
  customerId: string
  reference: string
  concept: string
  issuedOn: string
  dueOn: string
  amount: number
  payments: Payment[]
  disputed: boolean
  cancelled: boolean
  createdAt: string
}

export type Ledger = {
  version: 1
  customers: Customer[]
  receivables: Receivable[]
}

export type ReceivableStatus =
  | 'pendiente'
  | 'por-vencer'
  | 'vencida'
  | 'parcial'
  | 'pagada'
  | 'en-disputa'
  | 'anulada'

export const EMPTY_LEDGER = (): Ledger => ({ version: 1, customers: [], receivables: [] })
const STORAGE_KEY = 'expressapps.cobrolisto.ledger.v1'
const CLP_FORMATTER = new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0
})
const MAX_AMOUNT = 999_999_999_999

export const money = (amount: number): string => CLP_FORMATTER.format(amount)
export const isValidAmount = (amount: unknown): amount is number =>
  typeof amount === 'number' && Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_AMOUNT

export function dateDiff(iso: string, reference = new Date()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return NaN
  const [y, m, d] = iso.split('-').map(Number)
  const check = new Date(Date.UTC(y, m - 1, d))
  if (check.getUTCFullYear() !== y || check.getUTCMonth() + 1 !== m || check.getUTCDate() !== d) return NaN
  const today = Date.UTC(reference.getFullYear(), reference.getMonth(), reference.getDate())
  return Math.round((check.getTime() - today) / 86_400_000)
}

export function isValidDate(iso: string): boolean {
  return Number.isFinite(dateDiff(iso))
}

export function paymentTotal(receivable: Receivable): number {
  return receivable.payments.reduce((sum, payment) => sum + payment.amount, 0)
}

export function balance(receivable: Receivable): number {
  return Math.max(0, receivable.amount - paymentTotal(receivable))
}

export function status(receivable: Receivable, reference = new Date()): ReceivableStatus {
  if (receivable.cancelled) return 'anulada'
  if (balance(receivable) === 0) return 'pagada'
  if (receivable.disputed) return 'en-disputa'
  const days = dateDiff(receivable.dueOn, reference)
  if (days < 0) return 'vencida'
  if (days <= 7) return 'por-vencer'
  if (paymentTotal(receivable) > 0) return 'parcial'
  return 'pendiente'
}

export function aging(receivables: Receivable[], reference = new Date()) {
  const buckets = { current: 0, d1to30: 0, d31to60: 0, d61to90: 0, over90: 0 }
  for (const record of receivables) {
    if (record.cancelled) continue
    const owed = balance(record)
    if (!owed) continue
    const overdueDays = -dateDiff(record.dueOn, reference)
    if (overdueDays <= 0) buckets.current += owed
    else if (overdueDays <= 30) buckets.d1to30 += owed
    else if (overdueDays <= 60) buckets.d31to60 += owed
    else if (overdueDays <= 90) buckets.d61to90 += owed
    else buckets.over90 += owed
  }
  return buckets
}

export function overview(receivables: Receivable[], reference = new Date()) {
  const valid = receivables.filter(item => !item.cancelled)
  const outstanding = valid.reduce((sum, record) => sum + balance(record), 0)
  const collected = valid.reduce((sum, record) => sum + paymentTotal(record), 0)
  const overdue = valid.reduce((sum, record) =>
    dateDiff(record.dueOn, reference) < 0 ? sum + balance(record) : sum, 0)
  return { outstanding, collected, overdue, active: valid.filter(record => balance(record) > 0).length }
}

export function validateReceivable(input: Pick<Receivable, 'amount' | 'issuedOn' | 'dueOn' | 'reference' | 'customerId'>): string | null {
  if (!input.customerId) return 'Selecciona un cliente.'
  if (!input.reference.trim()) return 'Ingresa una referencia de factura o documento.'
  if (!isValidAmount(input.amount)) return 'El monto debe ser un número entero de pesos positivo.'
  if (!isValidDate(input.issuedOn) || !isValidDate(input.dueOn)) return 'Selecciona fechas válidas.'
  if (input.dueOn < input.issuedOn) return 'El vencimiento no puede ser anterior a la emisión.'
  return null
}

export function validatePayment(record: Receivable, amount: number, paymentDate: string): string | null {
  if (record.cancelled) return 'No se pueden registrar pagos sobre una cuenta anulada.'
  if (!isValidDate(paymentDate)) return 'Selecciona una fecha de pago válida.'
  if (!isValidAmount(amount)) return 'El abono debe ser un número entero de pesos positivo.'
  if (amount > balance(record)) return 'El abono supera el saldo pendiente.'
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function validCustomer(value: unknown): value is Customer {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string'
    && typeof value.email === 'string' && typeof value.phone === 'string'
    && typeof value.createdAt === 'string'
}
function validPayment(value: unknown): value is Payment {
  return isRecord(value) && typeof value.id === 'string' && isValidAmount(value.amount)
    && typeof value.date === 'string' && isValidDate(value.date)
    && typeof value.note === 'string' && typeof value.createdAt === 'string'
}
function validReceivable(value: unknown): value is Receivable {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string' || typeof value.customerId !== 'string'
    || typeof value.reference !== 'string' || typeof value.concept !== 'string'
    || typeof value.issuedOn !== 'string' || typeof value.dueOn !== 'string'
    || !isValidAmount(value.amount) || !isValidDate(value.issuedOn)
    || !isValidDate(value.dueOn) || !Array.isArray(value.payments)
    || typeof value.disputed !== 'boolean' || typeof value.cancelled !== 'boolean'
    || typeof value.createdAt !== 'string') return false
  const payments = value.payments as unknown[]
  return payments.every(validPayment)
    && payments.reduce<number>((sum, p) => sum + (p as Payment).amount, 0) <= value.amount
}
export function validateLedger(value: unknown): value is Ledger {
  if (!isRecord(value) || value.version !== 1
    || !Array.isArray(value.customers) || !Array.isArray(value.receivables)) return false
  if (!value.customers.every(validCustomer) || !value.receivables.every(validReceivable)) return false
  const ids = new Set((value.customers as Customer[]).map(c => c.id))
  return (value.receivables as Receivable[]).every(r => ids.has(r.customerId))
}

export function readLedger(): Ledger {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return EMPTY_LEDGER()
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('Los datos locales están dañados. Evita sobrescribirlos; exporta o recupera una copia.') }
  if (!validateLedger(parsed)) throw new Error('El formato de los registros locales no es válido. No se sobrescribirán automáticamente.')
  return parsed
}
export function saveLedger(value: Ledger): void {
  if (!validateLedger(value)) throw new Error('Los registros no pasaron la validación de integridad.')
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

export function csvCell(value: string | number): string {
  const raw = String(value)
  const protectedValue = /^[\s]*[=+\-@\t\r]/.test(raw) ? "'" + raw : raw
  return '"' + protectedValue.replaceAll('"', '""') + '"'
}

export function receivablesCsv(ledger: Ledger, reference = new Date()): string {
  const headers = ['Cliente', 'Documento', 'Concepto', 'Emisión', 'Vencimiento', 'Total CLP', 'Abonado CLP', 'Pendiente CLP', 'Estado']
  const rows = ledger.receivables.map(item => [
    ledger.customers.find(customer => customer.id === item.customerId)?.name ?? '',
    item.reference, item.concept, item.issuedOn, item.dueOn,
    item.amount, paymentTotal(item), item.cancelled ? 0 : balance(item), status(item, reference)
  ])
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n')
}

export function paymentsCsv(ledger: Ledger): string {
  const headers = ['Cliente', 'Documento', 'Fecha de abono', 'Monto CLP', 'Nota']
  const rows = ledger.receivables.flatMap(receivable =>
    receivable.payments.map(payment => [
      ledger.customers.find(customer => customer.id === receivable.customerId)?.name ?? '',
      receivable.reference, payment.date, payment.amount, payment.note
    ]))
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n')
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
