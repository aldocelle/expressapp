import { describe,expect,it } from 'vitest'
import {
  daysInMonth,equivalentMRR,nextDate,newContract,relativeDays,renew,
  renewalCsv,renewalStatus,summary,validStore,validateContract,
  type Contract
} from './renuevapro'

const testDate=new Date(2026,9,17)
const contract=(overrides:Partial<Contract>={}):Contract=>({
  id:'c1',customer:'Cliente Uno',service:'Hosting',amount:120000,
  startsOn:'2026-01-31',nextOn:'2026-10-31',cadence:'monthly',
  state:'active',anchorDay:31,monthEnd:true,note:'',history:[],createdAt:'2026-01-31T00:00:00Z',...overrides
})
describe('RenuevaPro · ciclos calendario',()=>{
  it('preserva fin de mes y anclaje original para fechas irregulares',()=>{
    expect(nextDate('2026-01-31','monthly',31,true)).toBe('2026-02-28')
    expect(nextDate('2026-02-28','monthly',31,true)).toBe('2026-03-31')
    expect(nextDate('2026-02-28','monthly',30,false)).toBe('2026-03-30')
    expect(nextDate('2028-02-29','annual',29,true)).toBe('2029-02-28')
    expect(daysInMonth(2028,2)).toBe(29)
  })
  it('identifica vencidas y próximas, excluye pausadas y canceladas',()=>{
    expect(renewalStatus(contract({nextOn:'2026-10-16'}),testDate)).toBe('overdue')
    expect(renewalStatus(contract({nextOn:'2026-10-31'}),testDate)).toBe('due-soon')
    expect(renewalStatus(contract({state:'paused'}),testDate)).toBe('paused')
    expect(summary([contract({state:'cancelled'})],testDate).active).toBe(0)
    expect(relativeDays('2026-10-17',testDate)).toBe(0)
  })
  it('calcula MRR contractual, distinto del efectivo cobrado',()=>{
    expect(equivalentMRR([
      contract({amount:120000,cadence:'annual'}),
      contract({id:'c2',amount:30000,cadence:'quarterly'}),
      contract({id:'c3',amount:90000,cadence:'monthly',state:'cancelled'})
    ])).toBe(20000)
  })
  it('registra confirmación y siguiente fecha sin renovaciones ocultas',()=>{
    const updated=renew(contract({nextOn:'2026-10-31'}),'2026-10-17')
    expect(updated.nextOn).toBe('2026-11-30')
    expect(updated.history).toHaveLength(1)
    expect(updated.history[0].previousDate).toBe('2026-10-31')
    expect(()=>renew(contract({state:'paused'}))).toThrow()
  })
  it('valida importes, rangos e integridad del almacenamiento',()=>{
    expect(validateContract(contract({amount:-1}))).toContain('precio')
    expect(validStore({version:1,contracts:[contract()]})).toBe(true)
    expect(validStore({version:1,contracts:[contract(),contract()]})).toBe(false)
  })
  it('exporta CSV protegido contra fórmulas',()=>{
    expect(renewalCsv({version:1,contracts:[contract({customer:'=SUM(1,2)'})]})).toContain("'=SUM(1,2)")
  })
})
