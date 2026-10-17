export type QuoteState = 'draft' | 'sent' | 'accepted' | 'rejected'
export type QuoteItem = { id:string; description:string; quantity:number; unitPrice:number }
export type QuoteEvent = { id:string; kind:'sent'|'followup'|'accepted'|'rejected'|'reopened'; at:string; note:string }
export type Quote = {
  id:string; number:string; customer:string; email:string; phone:string; subject:string;
  issuedOn:string; expiresOn:string; tax:'none'|'vat19'; items:QuoteItem[];
  notes:string; state:QuoteState; events:QuoteEvent[]; createdAt:string
}
export type QuoteStore = {version:1;quotes:Quote[]}
export const emptyQuotes=():QuoteStore=>({version:1,quotes:[]})
export const MAX_QUOTES=150
const KEY='expressapps.cotizafollow.v1'
export const money=(v:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(v)
export const isoToday=()=>{
  const d=new Date()
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')
}
export function validDate(raw:string):boolean{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return false
  const [y,m,d]=raw.split('-').map(Number), test=new Date(Date.UTC(y,m-1,d))
  return y>=1900&&y<=9998&&test.getUTCFullYear()===y&&test.getUTCMonth()+1===m&&test.getUTCDate()===d
}
export function dayDelta(raw:string,reference=new Date()):number{
  if(!validDate(raw))return NaN
  const [y,m,d]=raw.split('-').map(Number)
  return Math.round((Date.UTC(y,m-1,d)-Date.UTC(reference.getFullYear(),reference.getMonth(),reference.getDate()))/86400000)
}
export const pretty=(raw:string)=>validDate(raw)?raw.split('-').reverse().join('/'):'Fecha inválida'
export const validAmount=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=999_999_999
export const validQuantity=(n:unknown):n is number=>typeof n==='number'&&Number.isInteger(n)&&n>=1&&n<=10000
export function totals(q:Pick<Quote,'items'|'tax'>){
  const net=q.items.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0)
  const vat=q.tax==='vat19'?Math.round(net*0.19):0
  return {net,vat,total:net+vat}
}
export function quoteStatus(q:Quote,reference=new Date()):QuoteState|'expired'|'followup'{
  if(q.state!=='sent')return q.state
  if(dayDelta(q.expiresOn,reference)<0)return 'expired'
  return q.events.some(e=>e.kind==='followup')?'followup':'sent'
}
export function validateQuote(q:Pick<Quote,'customer'|'subject'|'number'|'email'|'issuedOn'|'expiresOn'|'items'|'tax'>):string|null{
  if(q.customer.trim().length<2)return 'Ingresa un cliente o empresa.'
  if(!q.subject.trim())return 'Describe el servicio cotizado.'
  if(!q.number.trim())return 'Indica un identificador de cotización.'
  if(q.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.email.trim()))return 'El correo no tiene un formato válido.'
  if(!validDate(q.issuedOn)||!validDate(q.expiresOn)||q.expiresOn<q.issuedOn)return 'Revisa las fechas de emisión y validez.'
  if(q.tax!=='none'&&q.tax!=='vat19')return 'El impuesto configurado no es válido.'
  if(q.items.length<1||q.items.length>30)return 'Agrega entre 1 y 30 conceptos.'
  if(!q.items.every(i=>i.description.trim().length>=2&&validQuantity(i.quantity)&&validAmount(i.unitPrice)))return 'Revisa conceptos, cantidades y precios enteros.'
  const value=totals(q)
  if(!Number.isSafeInteger(value.total)||value.total<=0||value.total>9_999_999_999)return 'El total debe ser positivo y estar dentro del límite.'
  return null
}
export function recordEvent(q:Quote,kind:QuoteEvent['kind'],note:string,at=isoToday()):Quote{
  if(!validDate(at))throw Error('Fecha inválida.')
  if(kind==='sent'&&q.state!=='draft')throw Error('Solo borradores pueden marcarse enviados.')
  if(kind==='followup'&&q.state!=='sent')throw Error('Solo propuestas enviadas admiten seguimiento.')
  if((kind==='accepted'||kind==='rejected')&&q.state!=='sent')throw Error('Solo propuestas enviadas pueden resolverse.')
  if(kind==='reopened'&&q.state==='draft')throw Error('La propuesta ya es un borrador.')
  const state:QuoteState=kind==='reopened'?'draft':kind==='accepted'?'accepted':kind==='rejected'?'rejected':'sent'
  return {...q,state,events:[...q.events,{id:crypto.randomUUID(),kind,at,note:note.trim().slice(0,400)}]}
}
export function quoteMetrics(records:Quote[]){
  const resolved=records.filter(q=>q.state==='accepted'||q.state==='rejected').length
  const sent=records.filter(q=>q.state==='sent'||q.state==='accepted'||q.state==='rejected').length
  const accepted=records.filter(q=>q.state==='accepted')
  return {
    total:records.length,active:records.filter(q=>q.state==='sent').length,
    accepted:accepted.length, acceptedValue:accepted.reduce((s,q)=>s+totals(q).total,0),
    openValue:records.filter(q=>q.state==='sent').reduce((s,q)=>s+totals(q).total,0),
    conversion:sent?Math.round(accepted.length/sent*100):0,resolved
  }
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
function validItem(v:unknown):v is QuoteItem{
  return object(v)&&typeof v.id==='string'&&typeof v.description==='string'&&validQuantity(v.quantity)&&validAmount(v.unitPrice)
}
function validEvent(v:unknown):v is QuoteEvent{
  return object(v)&&typeof v.id==='string'&&['sent','followup','accepted','rejected','reopened'].includes(String(v.kind))
    &&typeof v.at==='string'&&validDate(v.at)&&typeof v.note==='string'
}
function validRecord(v:unknown):v is Quote{
  if(!object(v))return false
  if(typeof v.id!=='string'||typeof v.number!=='string'||typeof v.customer!=='string'
    ||typeof v.email!=='string'||typeof v.phone!=='string'||typeof v.subject!=='string'
    ||typeof v.issuedOn!=='string'||typeof v.expiresOn!=='string'||typeof v.notes!=='string'
    ||typeof v.createdAt!=='string'||!['draft','sent','accepted','rejected'].includes(String(v.state))
    ||!Array.isArray(v.items)||!v.items.every(validItem)||!Array.isArray(v.events)||!v.events.every(validEvent))return false
  return validateQuote(v as Quote)===null
}
export function validStore(v:unknown):v is QuoteStore{
  if(!object(v)||v.version!==1||!Array.isArray(v.quotes)||v.quotes.length>MAX_QUOTES)return false
  return v.quotes.every(validRecord)&&new Set((v.quotes as Quote[]).map(q=>q.id)).size===v.quotes.length
}
export function loadQuotes():QuoteStore{
  const raw=localStorage.getItem(KEY)
  if(!raw)return emptyQuotes()
  let data:unknown
  try{data=JSON.parse(raw)}catch{throw Error('Los registros locales contienen JSON inválido.')}
  if(!validStore(data))throw Error('Los registros locales no pasaron validación; escritura bloqueada.')
  return data
}
export function saveQuotes(data:QuoteStore){
  if(!validStore(data))throw Error('Datos de cotización inválidos.')
  localStorage.setItem(KEY,JSON.stringify(data))
}
export function csvCell(value:string|number){
  const x=String(value),v=/^[\s]*[=+\-@\t\r]/.test(x)?"'"+x:x
  return '"'+v.replaceAll('"','""')+'"'
}
export function quotesCsv(quotes:Quote[],reference=new Date()){
  const rows:(string|number)[][]=[['Número','Cliente','Correo','Concepto','Emisión','Vencimiento','Neto CLP','IVA CLP','Total CLP','Estado','Seguimientos']]
  quotes.forEach(q=>{const t=totals(q);rows.push([
    q.number,q.customer,q.email,q.subject,q.issuedOn,q.expiresOn,t.net,t.vat,t.total,
    quoteStatus(q,reference),q.events.filter(e=>e.kind==='followup').length
  ])})
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n')
}
export function downloadCsv(content:string){
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}))
  const a=document.createElement('a')
  a.href=url;a.download='cotizafollow-cotizaciones.csv';document.body.appendChild(a);a.click();a.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}
