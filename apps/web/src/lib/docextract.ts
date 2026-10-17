export type DocumentKind = 'factura'|'boleta'|'orden'|'contrato'|'otro'
export type ExtractionMode = 'pdf-text'|'manual'
export type ExtractedFields = {
  issuer: string; rut: string; folio: string; date: string; dueDate: string;
  net: string; iva: string; total: string; recipient: string
}
export type ExtractRecord = {
  id: string; filename: string; bytes: number; kind: DocumentKind; mode: ExtractionMode;
  pages: number; fields: ExtractedFields; snippet: string;
  reviewed: boolean; createdAt: string
}
export type ExtractStore = {version:1;records:ExtractRecord[]}
export const emptyStore = ():ExtractStore => ({version:1,records:[]})
export const emptyFields = ():ExtractedFields => ({
  issuer:'',rut:'',folio:'',date:'',dueDate:'',net:'',iva:'',total:'',recipient:''
})
export const typeName:Record<DocumentKind,string>={
  factura:'Factura',boleta:'Boleta',orden:'Orden de compra',contrato:'Contrato',otro:'Otro documento'
}
const STORAGE='expressapps.docextract.v1'
const maxEntries=100
const MAX_SNIPPET=3500
const fieldKeys:(keyof ExtractedFields)[]=['issuer','rut','folio','date','dueDate','net','iva','total','recipient']
export function validISO(v:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false
  const [y,m,d]=v.split('-').map(Number)
  const p=new Date(Date.UTC(y,m-1,d))
  return y>=1900&&y<=9998&&p.getUTCFullYear()===y&&p.getUTCMonth()===m-1&&p.getUTCDate()===d
}
export function formatDate(input: string): string {
  const v=input.trim()
  const iso=v.match(/\b((?:19|20)\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if(iso){ const out=[iso[1],iso[2].padStart(2,'0'),iso[3].padStart(2,'0')].join('-');return validISO(out)?out:'' }
  const ch=v.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.]((?:19|20)\d{2})\b/)
  if(ch){const out=[ch[3],ch[2].padStart(2,'0'),ch[1].padStart(2,'0')].join('-');return validISO(out)?out:''}
  return ''
}
export function validRut(input:string):boolean {
  const clean=input.replace(/\./g,'').replace(/-/g,'').trim().toUpperCase()
  if(!/^\d{7,8}[0-9K]$/.test(clean))return false
  const body=clean.slice(0,-1);const dv=clean.slice(-1)
  let sum=0,weight=2
  for(let i=body.length-1;i>=0;i--){sum+=Number(body[i])*weight;weight=weight===7?2:weight+1}
  const code=11-sum%11
  const expected=code===11?'0':code===10?'K':String(code)
  return dv===expected
}
export function asCLP(raw:string):string {
  let value=raw.replace(/\s/g,'').replace(/[$]/g,'').trim()
  if(!value)return ''
  // CLP whole peso values only. Remove an explicit ,00 decimal suffix.
  value=value.replace(/,00$/,'')
  if(!/^\d{1,3}(?:\.\d{3})*$/.test(value)&&!/^\d+$/.test(value))return ''
  const number=Number(value.replace(/\./g,''))
  return Number.isSafeInteger(number)?String(number):''
}
function findField(text:string,labels:string[],capture='([^\\r\\n]{1,100})'):string {
  for(const label of labels){
    const re=new RegExp('(?:^|\\n)\\s*(?:'+label+')\\s*[:#º°-]?\\s*'+capture,'im')
    const found=text.match(re)
    if(found?.[1])return found[1].trim()
  }
  return ''
}
function nextNumber(text:string,labels:string[]):string {
  const moneyCapture='\\$?\\s*([0-9][0-9.]{0,20}(?:,00)?)'
  const found=findField(text,labels,moneyCapture)
  return asCLP(found)
}
export function parseDocumentText(text:string):ExtractedFields {
  const src=text.slice(0,250000).replace(/\r\n?/g,'\n')
  const rut=src.match(/\b(?:R\.?\s*U\.?\s*T\.?|RUT)\s*(?:emisor|proveedor)?\s*[:#-]?\s*(\d{1,2}\.?\d{3}\.?\d{3}[-\s]?[0-9kK])\b/i)
    ?? src.match(/\b(\d{1,2}\.?\d{3}\.?\d{3}-[0-9kK])\b/)
  const folio=findField(src,['(?:N[°ºo]\\.?\\s*)?(?:Folio|Número\\s*(?:documento|factura)|Nro\\.?\\s*documento)'],'([\\w\\/-]{1,35})')
  const issued=findField(src,['Fecha\\s*(?:de\\s*)?(?:emisión|emision|documento)','Emitid[ao]\\s*el'],'(\\d{1,4}[-/.]\\d{1,2}[-/.]\\d{2,4})')
  const due=findField(src,['Fecha\\s*(?:de\\s*)?vencimiento','Vence\\s*el'],'(\\d{1,4}[-/.]\\d{1,2}[-/.]\\d{2,4})')
  return {
    issuer:findField(src,['Razón\\s*Social','Razon\\s*Social','Emisor','Proveedor']).slice(0,120),
    rut:rut?.[1]?.trim()??'', folio:folio.slice(0,70),
    date:formatDate(issued),dueDate:formatDate(due),
    net:nextNumber(src,['Monto\\s*Neto','Neto','Subtotal']),
    iva:nextNumber(src,['I\\.?V\\.?A\\.?\\s*(?:19\\s*%)?','Impuesto\\s*IVA']),
    total:nextNumber(src,['Monto\\s*Total','Total\\s*a\\s*pagar','TOTAL']),
    recipient:findField(src,['Receptor','Cliente']).slice(0,120)
  }
}
export function fieldWarnings(fields:ExtractedFields):string[] {
  const warnings:string[]=[]
  if(fields.rut && !validRut(fields.rut))warnings.push('El RUT no pasó la validación de dígito verificador.')
  if(fields.date && !validISO(fields.date))warnings.push('La fecha de emisión no es válida.')
  if(fields.dueDate && !validISO(fields.dueDate))warnings.push('La fecha de vencimiento no es válida.')
  for(const name of ['net','iva','total'] as const){
    if(fields[name] && (!/^\d+$/.test(fields[name]) || !Number.isSafeInteger(Number(fields[name])))){
      warnings.push('El campo '+name.toUpperCase()+' debe contener pesos enteros.')
    }
  }
  if(fields.net&&fields.iva&&fields.total&&
    [fields.net,fields.iva,fields.total].every(s=>/^\d+$/.test(s))) {
    const [net,iva,total]=[Number(fields.net),Number(fields.iva),Number(fields.total)]
    if(net+iva!==total)warnings.push('Neto + IVA no coincide con el total registrado.')
  }
  return warnings
}
export function canApprove(record:ExtractRecord):string|null {
  if(!record.filename.trim())return 'El documento requiere un nombre.'
  if(!record.fields.folio && !record.fields.total && !record.fields.issuer)
    return 'Revisa o introduce al menos emisor, folio o monto total.'
  const warnings=fieldWarnings(record.fields)
  return warnings.length?warningsJoined(warnings):null
}
function warningsJoined(warnings:string[]):string { return warnings.join(' ') }
const isObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
export function validStore(value:unknown):value is ExtractStore {
  if(!isObject(value)||value.version!==1||!Array.isArray(value.records)||value.records.length>maxEntries)return false
  const records=value.records as unknown[]
  if(!records.every(r=>{
    if(!isObject(r)||typeof r.id!=='string'||typeof r.filename!=='string'||typeof r.bytes!=='number'||
      !Number.isFinite(r.bytes)||r.bytes<0||!['factura','boleta','orden','contrato','otro'].includes(String(r.kind))||
      !['pdf-text','manual'].includes(String(r.mode))||typeof r.pages!=='number'||
      !Number.isInteger(r.pages)||r.pages<0||r.pages>30||!isObject(r.fields)||
      typeof r.snippet!=='string'||r.snippet.length>MAX_SNIPPET||
      typeof r.reviewed!=='boolean'||typeof r.createdAt!=='string')return false
    return fieldKeys.every(k=>typeof (r.fields as Record<string,unknown>)[k]==='string')
  }))return false
  return new Set(records.map(x=>(x as ExtractRecord).id)).size===records.length
}
export function readStore():ExtractStore {
  const raw=localStorage.getItem(STORAGE)
  if(!raw)return emptyStore()
  let parsed:unknown
  try{parsed=JSON.parse(raw)}catch{throw new Error('Los registros locales están dañados.')}
  if(!validStore(parsed))throw new Error('No se pudo validar el formato. La edición se bloqueó para preservar datos.')
  return parsed
}
export function saveStore(value:ExtractStore):void{
  if(!validStore(value))throw new Error('Los registros no superaron la validación.')
  localStorage.setItem(STORAGE,JSON.stringify(value))
}
const safeCell=(input:string|number)=>{
  const value=String(input)
  const safe=/^[\s]*[=+\-@\t\r]/.test(value)?"'"+value:value
  return '"'+safe.replaceAll('"','""')+'"'
}
export function recordsCsv(records:ExtractRecord[]):string{
  const rows:(string|number)[][]=[['Archivo','Tipo','Modo','Revisado','Emisor','RUT','Folio','Emisión','Vencimiento','Neto','IVA','Total','Receptor']]
  for(const r of records){
    const f=r.fields
    rows.push([r.filename,typeName[r.kind],r.mode,r.reviewed?'Sí':'No',f.issuer,f.rut,f.folio,f.date,f.dueDate,f.net,f.iva,f.total,f.recipient])
  }
  return '\uFEFF'+rows.map(row=>row.map(safeCell).join(';')).join('\r\n')
}
export function download(content:string,filename:string,type:string):void{
  const url=URL.createObjectURL(new Blob([content],{type}))
  const a=document.createElement('a');a.href=url;a.download=filename
  document.body.appendChild(a);a.click();a.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export const MAX_BYTES=10*1024*1024
export const MAX_PAGES=30
export const MAX_ITEMS=maxEntries
