import { describe,expect,it } from 'vitest'
import {
  asCLP,canApprove,emptyFields,fieldWarnings,formatDate,
  parseDocumentText,recordsCsv,validRut,validStore,type ExtractRecord
} from './docextract'
const document=(overrides:Partial<ExtractRecord>={}):ExtractRecord=>({
  id:'d1',filename:'comprobante.pdf',bytes:1200,kind:'factura',mode:'pdf-text',
  pages:1,fields:emptyFields(),snippet:'Factura',reviewed:false,createdAt:'2026-10-17T00:00:00Z',...overrides
})
describe('DocExtract · lectura asistida y revisión humana',()=>{
  it('interpreta datos de una factura de texto seleccionable sin inventar los ausentes',()=>{
    const fields=parseDocumentText([
      'FACTURA ELECTRONICA','Razón Social: Empresa de Prueba SpA',
      'RUT: 12.345.678-5','Folio: 1234',
      'Fecha emisión: 17/10/2026','Neto: $10.000','IVA: $1.900','Total: $11.900'
    ].join('\n'))
    expect(fields.issuer).toBe('Empresa de Prueba SpA')
    expect(fields.rut).toBe('12.345.678-5')
    expect(fields.folio).toBe('1234')
    expect(fields.date).toBe('2026-10-17')
    expect(fields.net).toBe('10000')
    expect(fields.iva).toBe('1900')
    expect(fields.total).toBe('11900')
    expect(fields.dueDate).toBe('')
    expect(fieldWarnings(fields)).toEqual([])
  })
  it('evita fechas imposibles y valida RUT chileno',()=>{
    expect(formatDate('31/02/2026')).toBe('')
    expect(formatDate('29/02/2028')).toBe('2028-02-29')
    expect(validRut('12.345.678-5')).toBe(true)
    expect(validRut('12.345.678-0')).toBe(false)
  })
  it('solo acepta montos CLP enteros reconocibles',()=>{
    expect(asCLP('$1.234.567')).toBe('1234567')
    expect(asCLP('1.900,00')).toBe('1900')
    expect(asCLP('1,900.50')).toBe('')
  })
  it('no marca revisado un registro sin información o con inconsistencia',()=>{
    expect(canApprove(document())).toContain('al menos')
    const fields={...emptyFields(),issuer:'Empresa SpA',rut:'12.345.678-0'}
    expect(canApprove(document({fields}))).toContain('RUT')
    expect(canApprove(document({fields:{...fields,rut:'12.345.678-5'}}))).toBeNull()
  })
  it('valida formato local y evita ejecución de fórmulas en CSV',()=>{
    const record=document({fields:{...emptyFields(),issuer:'=SUM(1,2)'}})
    expect(validStore({version:1,records:[record]})).toBe(true)
    expect(recordsCsv([record])).toContain("'=SUM(1,2)")
    expect(validStore({version:1,records:[{...record,pages:1000}]})).toBe(false)
  })
})
