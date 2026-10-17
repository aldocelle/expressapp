import { describe, expect, it } from 'vitest'
import {
  aging, balance, csvCell, dateDiff, isValidAmount, money, overview,
  paymentTotal, paymentsCsv, receivablesCsv, status, validateLedger,
  validatePayment, validateReceivable, type Ledger, type Receivable
} from './cobrolisto'

const reference = new Date(2026, 9, 17)
const record = (overrides: Partial<Receivable> = {}): Receivable => ({
  id: 'r1',
  customerId: 'c1',
  reference: 'F-123',
  concept: 'Mantención',
  amount: 100_000,
  issuedOn: '2026-09-01',
  dueOn: '2026-10-01',
  payments: [],
  disputed: false,
  cancelled: false,
  createdAt: '2026-09-01T11:00:00Z',
  ...overrides
})
const payment = (amount: number) => ({
  id: 'p1', amount, date: '2026-10-02', note: 'Transferencia', createdAt: '2026-10-02T13:00:00Z'
})
const ledger = (records: Receivable[]): Ledger => ({
  version: 1,
  customers: [{ id: 'c1', name: 'Cliente Uno', email: '', phone: '', createdAt: '2026-09-01' }],
  receivables: records
})

describe('CobroListo · estados y deuda real', () => {
  it('calcula pesos enteros, pagos parciales y saldos correctamente', () => {
    const r = record({ payments: [payment(25_000)] })
    expect(paymentTotal(r)).toBe(25_000)
    expect(balance(r)).toBe(75_000)
    expect(money(75000)).toContain('75.000')
  })
  it('cuenta deudas vencidas incluso si existe un abono parcial', () => {
    const r = record({ payments: [payment(25_000)] })
    expect(status(r, reference)).toBe('vencida')
    expect(overview([r], reference)).toEqual({ outstanding: 75000, collected: 25000, overdue: 75000, active: 1 })
  })
  it('prioriza pagadas, disputadas y anuladas en ese orden', () => {
    expect(status(record({ payments: [payment(100_000)], disputed: true }), reference)).toBe('pagada')
    expect(status(record({ disputed: true }), reference)).toBe('en-disputa')
    expect(status(record({ cancelled: true }), reference)).toBe('anulada')
    expect(overview([record({ cancelled: true })], reference).outstanding).toBe(0)
  })
  it('identifica saldos por vencer, parciales y pendientes', () => {
    expect(status(record({ dueOn: '2026-10-22' }), reference)).toBe('por-vencer')
    expect(status(record({ dueOn: '2026-12-22', payments: [payment(1000)] }), reference)).toBe('parcial')
    expect(status(record({ dueOn: '2026-12-22' }), reference)).toBe('pendiente')
  })
  it('clasifica aging por saldo, no por monto original', () => {
    const result = aging([
      record({ payments: [payment(50_000)], dueOn: '2026-09-20' }), // 27 días atrasada
      record({ id: 'r2', dueOn: '2026-08-20' }), // 58 días
      record({ id: 'r3', dueOn: '2026-07-20' }), // 89 días
      record({ id: 'r4', dueOn: '2026-06-01' }), // 138 días
      record({ id: 'r5', dueOn: '2026-11-15' }),
      record({ id: 'r6', cancelled: true })
    ], reference)
    expect(result).toEqual({ current: 100_000, d1to30: 50_000, d31to60: 100_000, d61to90: 100_000, over90: 100_000 })
  })
})

describe('CobroListo · protección de registros', () => {
  it('impide abonos negativos, fraccionarios o mayores al saldo', () => {
    const r = record({ payments: [payment(90_000)] })
    expect(validatePayment(r, 20_000, '2026-10-17')).toContain('supera')
    expect(validatePayment(r, -1, '2026-10-17')).toContain('entero')
    expect(validatePayment(r, 2.7, '2026-10-17')).toContain('entero')
    expect(validatePayment(r, 10_000, '2026-10-17')).toBeNull()
    expect(isValidAmount(Number.MAX_SAFE_INTEGER)).toBe(false)
  })
  it('rechaza fechas inválidas y vencimiento anterior a emisión', () => {
    expect(Number.isNaN(dateDiff('2026-02-30', reference))).toBe(true)
    expect(validateReceivable({
      customerId: 'c1', reference: 'DOC', amount: 10_000, issuedOn: '2026-10-17', dueOn: '2026-10-16'
    })).toContain('anterior')
  })
  it('no acepta pagos que superan el valor del documento desde almacenamiento', () => {
    expect(validateLedger(ledger([record({ payments: [payment(120_000)] })]))).toBe(false)
    expect(validateLedger(ledger([record()]))).toBe(true)
  })
  it('previene inyección de fórmulas y escapa comillas en exportaciones', () => {
    expect(csvCell(' =SUM(A1:A2)')).toContain("' =SUM")
    const l = ledger([record({ reference: '=SHELL()', concept: 'Servicio "extra"', payments: [payment(50_000)] })])
    expect(receivablesCsv(l, reference)).toContain("'=SHELL()")
    expect(receivablesCsv(l, reference)).toContain('""extra""')
    expect(paymentsCsv(l)).toContain('50.000').toBe(false) // CSV almacena CLP enteros sin formato
    expect(paymentsCsv(l)).toContain('50000')
  })
})
