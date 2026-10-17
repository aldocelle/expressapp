export type Certificate = {
  id:string; token:string; recipient:string; course:string; issuer:string; instructor:string;
  hours:number; issuedOn:string; revoked:boolean; revocationReason:string; createdAt:string
}
export type CertificateStore={version:1;certificates:Certificate[]}
export const emptyCertificates=():CertificateStore=>({version:1,certificates:[]})
export const MAX_CERTS=250
const STORAGE='expressapps.certiqr.v1'
export const today=()=>{
  const d=new Date()
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')
}
export function validDate(value:string):boolean{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
  const [y,m,d]=value.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d))
  return y>=1900&&y<=9998&&dt.getUTCFullYear()===y&&dt.getUTCMonth()+1===m&&dt.getUTCDate()===d
}
export function pretty(value:string):string{
  if(!validDate(value))return 'Fecha no válida'
  const [y,m,d]=value.split('-')
  return d+'/'+m+'/'+y
}
export function validateCertificate(value:Pick<Certificate,'recipient'|'course'|'issuer'|'instructor'|'hours'|'issuedOn'>):string|null{
  if(value.recipient.trim().length<2)return 'Ingresa el nombre del participante.'
  if(value.course.trim().length<2)return 'Ingresa el nombre de la actividad.'
  if(value.issuer.trim().length<2)return 'Ingresa la institución emisora.'
  if(!Number.isInteger(value.hours)||value.hours<1||value.hours>10000)return 'La duración debe ser un número entero entre 1 y 10.000 horas.'
  if(!validDate(value.issuedOn))return 'La fecha no es válida.'
  if(value.instructor.trim().length>120)return 'El nombre del responsable es demasiado largo.'
  return null
}
export function createCertificate(value:Pick<Certificate,'recipient'|'course'|'issuer'|'instructor'|'hours'|'issuedOn'>):Certificate{
  const error=validateCertificate(value)
  if(error)throw Error(error)
  return {...value,id:crypto.randomUUID(),token:crypto.randomUUID(),
    revoked:false,revocationReason:'',createdAt:new Date().toISOString()}
}
export function revokeCertificate(c:Certificate,reason:string):Certificate{
  if(c.revoked)throw Error('Este certificado ya está revocado.')
  if(reason.trim().length<3)throw Error('Indica brevemente la razón de revocación.')
  return {...c,revoked:true,revocationReason:reason.trim().slice(0,250)}
}
export type VerificationResult={result:'valid'|'revoked'|'missing'|'invalid';certificate?:Certificate}
export function verifyCertificate(records:Certificate[],token:string):VerificationResult{
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(token))
    return {result:'invalid'}
  const certificate=records.find(c=>c.token===token)
  if(!certificate)return {result:'missing'}
  return {result:certificate.revoked?'revoked':'valid',certificate}
}
export function verificationUrl(c:Certificate,location:{origin:string;pathname:string}):string{
  return location.origin+location.pathname+'#/certiqr/verify/'+encodeURIComponent(c.token)
}
const isObject=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)
function validRecord(value:unknown):value is Certificate{
  return isObject(value)&&typeof value.id==='string'&&typeof value.token==='string'&&
    typeof value.recipient==='string'&&typeof value.course==='string'&&typeof value.issuer==='string'&&
    typeof value.instructor==='string'&&typeof value.hours==='number'&&typeof value.issuedOn==='string'&&
    typeof value.revoked==='boolean'&&typeof value.revocationReason==='string'&&
    typeof value.createdAt==='string'&&validateCertificate(value as Certificate)===null
}
export function validStore(value:unknown):value is CertificateStore{
  if(!isObject(value)||value.version!==1||!Array.isArray(value.certificates)||value.certificates.length>MAX_CERTS)return false
  if(!value.certificates.every(validRecord))return false
  const certificates=value.certificates as Certificate[]
  return new Set(certificates.map(c=>c.id)).size===certificates.length &&
    new Set(certificates.map(c=>c.token)).size===certificates.length
}
export function readCertificates():CertificateStore{
  const raw=localStorage.getItem(STORAGE)
  if(!raw)return emptyCertificates()
  let data:unknown
  try{data=JSON.parse(raw)}catch{throw Error('Datos locales dañados.')}
  if(!validStore(data))throw Error('Los registros no superaron la validación. Se bloqueó su edición.')
  return data
}
export function saveCertificates(value:CertificateStore):void{
  if(!validStore(value))throw Error('El lote contiene datos inválidos.')
  localStorage.setItem(STORAGE,JSON.stringify(value))
}
export function parseNames(text:string):string[]{
  return [...new Set(text.split(/\r?\n/g).map(x=>x.trim()).filter(Boolean))]
}
export function safeCsvCell(value:string|number){
  const raw=String(value)
  const out=/^[\s]*[=+\-@\t\r]/.test(raw)?"'"+raw:raw
  return '"'+out.replaceAll('"','""')+'"'
}
export function certificatesCsv(records:Certificate[]):string{
  const rows:(string|number)[][]=[['Código','Participante','Actividad','Emisor','Horas','Fecha','Estado']]
  for(const c of records)rows.push([c.token,c.recipient,c.course,c.issuer,c.hours,c.issuedOn,c.revoked?'Revocado':'Emitido'])
  return '\uFEFF'+rows.map(row=>row.map(safeCsvCell).join(';')).join('\r\n')
}
export function downloadCsv(content:string){
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}))
  const a=document.createElement('a')
  a.href=url;a.download='certiqr-certificados.csv';document.body.appendChild(a);a.click();a.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}
