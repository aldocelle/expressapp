import { describe, expect, it } from 'vitest'
import { dayDifference, documentsToCsv, getDocumentStatus } from './documents'

describe('VenceYa: cálculos por fecha civil', () => {
  const today = new Date(2026, 9, 17)
  it('marca documentos caducados', () => {
    expect(getDocumentStatus('2026-10-16', today)).toBe('vencido')
  })
  it('incluye el día de vencimiento y el límite de 30 días', () => {
    expect(getDocumentStatus('2026-10-17', today)).toBe('por-vencer')
    expect(getDocumentStatus('2026-11-16', today)).toBe('por-vencer')
    expect(getDocumentStatus('2026-11-17', today)).toBe('vigente')
  })
  it('descarta fechas imposibles', () => {
    expect(Number.isNaN(dayDifference('2026-02-30', today))).toBe(true)
  })
  it('escapa celdas peligrosas en CSV', () => {
    const csv = documentsToCsv([{
      id:'1', name:'=SUM(1,1)', category:'Contrato', owner:'Equipo',
      expiresOn:'2099-01-01', notes:'Nota con "comillas"', createdAt:'2026-10-17'
    }])
    expect(csv).toContain("'=SUM(1,1)")
    expect(csv).toContain('""comillas""')
  })
})
