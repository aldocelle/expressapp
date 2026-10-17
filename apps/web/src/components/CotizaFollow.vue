<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  ArrowRight, Check, CheckCheck, CircleAlert, Download, FileDown, FilePlus2,
  Handshake, Mail, MessageSquareText, Pencil, Plus, Search, Send, Trash2,
  TrendingUp, X
} from 'lucide-vue-next'
import { jsPDF } from 'jspdf'
import {
  downloadCsv,emptyQuotes,isoToday,loadQuotes,money,pretty,quoteMetrics,quoteStatus,
  quotesCsv,recordEvent,saveQuotes,totals,validateQuote, type Quote,type QuoteItem,type QuoteStore,
  type QuoteEvent
} from '../lib/cotizafollow'
import '../commerce-lab.css'

const emptyDraft=()=>({
  number:'COT-'+String(Date.now()).slice(-7),customer:'',email:'',phone:'',
  subject:'',issuedOn:isoToday(),expiresOn:isoToday(),tax:'vat19' as Quote['tax'],
  notes:'',items:[{id:crypto.randomUUID(),description:'',quantity:1,unitPrice:0}] as QuoteItem[]
})
let initial=emptyQuotes()
const loadingError=ref('')
try{initial=loadQuotes()}catch(error){loadingError.value=error instanceof Error?error.message:'No fue posible leer el almacenamiento.'}
const store=ref<QuoteStore>(initial)
const locked=computed(()=>!!loadingError.value)
const notice=ref('')
const query=ref('')
const filter=ref('all')
const editing=ref<string|null>(null)
const formOpen=ref(false)
const selectedId=ref<string|null>(null)
const followupOpen=ref(false)
const followupNote=ref('')
const formError=ref('')
const draft=reactive(emptyDraft())
const chosen=computed(()=>store.value.quotes.find(q=>q.id===selectedId.value)??null)
const metrics=computed(()=>quoteMetrics(store.value.quotes))
const draftTotals=computed(()=>totals(draft))
const statuses:Record<string,string>={draft:'Borrador',sent:'Enviada',followup:'En seguimiento',accepted:'Aceptada',rejected:'Rechazada',expired:'Vencida'}
const eventNames:Record<QuoteEvent['kind'],string>={
  sent:'Envío declarado',followup:'Seguimiento registrado',accepted:'Aceptación registrada',
  rejected:'Rechazo registrado',reopened:'Reabierta como borrador'
}
const filtered=computed(()=>store.value.quotes.filter(q=>{
  const txt=[q.customer,q.number,q.subject,q.email].join(' ').toLocaleLowerCase('es')
  return txt.includes(query.value.toLocaleLowerCase('es'))&&(filter.value==='all'||quoteStatus(q)===filter.value)
}).sort((a,b)=>b.issuedOn.localeCompare(a.issuedOn)))

function persist(value:QuoteStore):boolean{
  if(locked.value)return false
  try{saveQuotes(value);store.value=value;notice.value='';return true}
  catch(error){notice.value=error instanceof Error?error.message:'No fue posible guardar el cambio.';return false}
}
function create(){
  if(locked.value)return
  if(store.value.quotes.length>=150){notice.value='Límite local de 150 cotizaciones.';return}
  Object.assign(draft,emptyDraft())
  editing.value=null;formError.value='';formOpen.value=true
}
function edit(q:Quote){
  if(locked.value||q.state!=='draft'){notice.value='Para editar una cotización enviada debes reabrirla como borrador, conservando su historial.';return}
  Object.assign(draft,{
    number:q.number,customer:q.customer,email:q.email,phone:q.phone,
    subject:q.subject,issuedOn:q.issuedOn,expiresOn:q.expiresOn,tax:q.tax,
    notes:q.notes,items:q.items.map(i=>({...i}))
  })
  editing.value=q.id;formError.value='';formOpen.value=true
}
function addItem(){if(draft.items.length<30)draft.items.push({id:crypto.randomUUID(),description:'',quantity:1,unitPrice:0})}
function removeItem(id:string){if(draft.items.length>1)draft.items=draft.items.filter(i=>i.id!==id)}
function save(){
  const payload={number:draft.number.trim(),customer:draft.customer.trim(),email:draft.email.trim(),
    phone:draft.phone.trim(),subject:draft.subject.trim(),issuedOn:draft.issuedOn,expiresOn:draft.expiresOn,
    tax:draft.tax,items:draft.items.map(i=>({id:i.id,description:i.description.trim(),quantity:Number(i.quantity),unitPrice:Number(i.unitPrice)})),
    notes:draft.notes.trim()
  }
  const error=validateQuote(payload)
  if(error){formError.value=error;return}
  const original=store.value.quotes.find(q=>q.id===editing.value)
  if(store.value.quotes.some(q=>q.number===payload.number&&q.id!==original?.id)){
    formError.value='Ese número ya existe en otra cotización.';return
  }
  const quotes:Quote[]=original
    ?store.value.quotes.map(q=>q.id===original.id?{...q,...payload}:q)
    :[{...payload,id:crypto.randomUUID(),state:'draft',events:[],createdAt:new Date().toISOString()},...store.value.quotes]
  if(persist({...store.value,quotes}))formOpen.value=false
}
function change(q:Quote,kind:QuoteEvent['kind'],message:string){
  if(locked.value)return
  if(kind==='reopened'&&!window.confirm('Reabrir la cotización como borrador permitirá editarla. El historial quedará registrado.'))return
  try{
    const changed=recordEvent(q,kind,message)
    persist({...store.value,quotes:store.value.quotes.map(x=>x.id===q.id?changed:x)})
    followupOpen.value=false;followupNote.value=''
  }catch(error){notice.value=error instanceof Error?error.message:'No se pudo actualizar el estado.'}
}
function recordFollowup(){
  if(!chosen.value)return
  if(followupNote.value.trim().length<3){notice.value='Describe brevemente el contacto o gestión realizada.';return}
  change(chosen.value,'followup',followupNote.value.trim())
}
function deleteQuote(q:Quote){
  if(locked.value)return
  if(q.events.length){notice.value='Las cotizaciones con historial no pueden borrarse en esta demo.';return}
  if(!window.confirm('¿Eliminar el borrador '+q.number+' definitivamente?'))return
  if(persist({...store.value,quotes:store.value.quotes.filter(x=>x.id!==q.id)})){
    if(selectedId.value===q.id)selectedId.value=null
  }
}
function quotePdf(q:Quote){
  try{
    const pdf=new jsPDF({unit:'mm',format:'a4'})
    const accent:[number,number,number]=[58,76,54]
    const lines=totals(q)
    pdf.setFillColor(...accent);pdf.rect(0,0,210,43,'F')
    pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(23);pdf.text('COTIZACION',19,24)
    pdf.setFontSize(10);pdf.setFont('helvetica','normal');pdf.text(q.number,191,24,{align:'right'})
    pdf.setTextColor(45,55,49);pdf.setFontSize(11)
    pdf.text('Cliente: '+q.customer,19,56)
    pdf.text('Emision: '+pretty(q.issuedOn)+'    Validez hasta: '+pretty(q.expiresOn),19,64)
    if(q.email)pdf.text('Contacto: '+q.email,19,72)
    pdf.setFont('helvetica','bold');pdf.setFontSize(15)
    pdf.text(pdf.splitTextToSize(q.subject,170),19,86)
    let y=105
    pdf.setFontSize(10)
    for(const [i,item] of q.items.entries()){
      if(y>248){pdf.addPage();y=22}
      const text=pdf.splitTextToSize((i+1)+'. '+item.description,102)
      pdf.setFont('helvetica','normal')
      pdf.text(text,19,y)
      pdf.text(String(item.quantity)+' x '+money(item.unitPrice),191,y,{align:'right'})
      y+=Math.max(9,text.length*5+4)
    }
    if(y>242){pdf.addPage();y=24}
    pdf.setDrawColor(220,225,217);pdf.line(19,y,191,y);y+=10
    pdf.setFont('helvetica','normal')
    pdf.text('Neto: '+money(lines.net),191,y,{align:'right'});y+=7
    pdf.text(q.tax==='vat19'?'IVA 19%: '+money(lines.vat):'Sin IVA aplicado',191,y,{align:'right'});y+=9
    pdf.setFont('helvetica','bold');pdf.setFontSize(15);pdf.text('TOTAL '+money(lines.total),191,y,{align:'right'})
    if(q.notes){y+=13;pdf.setFontSize(10);pdf.setFont('helvetica','normal');pdf.text(pdf.splitTextToSize(q.notes,170),19,y)}
    pdf.setFontSize(8);pdf.setTextColor(119,130,119)
    pdf.text('Propuesta comercial. No es factura ni documento tributario.',19,286)
    pdf.save('cotizacion-'+q.number.replace(/[^a-zA-Z0-9-]/g,'_')+'.pdf')
  }catch(error){notice.value=error instanceof Error?error.message:'No fue posible generar el PDF.'}
}
</script>

<template>
  <div class="trade trade-quotes">
    <section class="trade-hero">
      <div class="trade-hero-copy">
        <span class="trade-eyebrow"><b>CF</b> EXPRESSAPPS / VENTAS</span>
        <h1>Cotiza<span>Follow.</span></h1>
        <p>Una propuesta no termina<br>cuando presionas enviar.</p>
        <button class="trade-hero-cta" :disabled="locked" @click="create"><Plus :size="17"/> Nueva cotización <ArrowRight :size="17"/></button>
      </div>
      <div class="trade-hero-figure">
        <span>COTIZACIONES ABIERTAS · MONTO TOTAL</span>
        <strong>{{ money(metrics.openValue) }}</strong>
        <p>Valor cotizado todavía sin aceptación ni rechazo.</p>
        <div aria-hidden="true" class="trade-watermark"><TrendingUp :size="132" :stroke-width="0.75"/></div>
      </div>
    </section>
    <div class="trade-notice"><CircleAlert :size="18"/><span><b>Demo local.</b> Los datos quedan solo en este navegador. No se envían correos ni recordatorios: las acciones de envío y seguimiento son registros manuales.</span></div>
    <div v-if="loadingError" class="trade-error" role="alert">{{ loadingError }} Se bloqueó la escritura para no sobrescribir datos.</div>
    <div v-if="notice" class="trade-error" role="alert">{{ notice }} <button aria-label="Cerrar aviso" @click="notice=''"><X :size="16"/></button></div>

    <div class="trade-metrics">
      <div><span><FilePlus2 :size="17"/> Propuestas</span><strong>{{ metrics.total }}</strong><small>Total registrado</small></div>
      <div><span><Send :size="17"/> Enviadas pendientes</span><strong>{{ metrics.active }}</strong><small>Incluye seguimiento y vencidas</small></div>
      <div><span><Handshake :size="17"/> Aceptadas</span><strong>{{ metrics.accepted }}</strong><small>{{ money(metrics.acceptedValue) }} en propuestas aceptadas</small></div>
      <div><span><TrendingUp :size="17"/> Conversión registrada</span><strong>{{ metrics.conversion }}%</strong><small>Sobre propuestas marcadas como enviadas</small></div>
    </div>

    <section class="trade-panel">
      <header class="trade-panel-head">
        <div><span class="trade-overline">PIPELINE COMERCIAL</span><h2>Tus cotizaciones <em>{{ store.quotes.length }}</em></h2></div>
        <button class="trade-quiet" :disabled="!store.quotes.length" @click="downloadCsv(quotesCsv(store.quotes))"><Download :size="16"/> Exportar CSV</button>
      </header>
      <div class="trade-toolbar">
        <label class="trade-search"><Search :size="17"/><input v-model="query" placeholder="Buscar cliente o propuesta" aria-label="Buscar cotizaciones"/></label>
        <select v-model="filter" aria-label="Filtrar cotizaciones">
          <option value="all">Todos los estados</option><option value="draft">Borradores</option>
          <option value="sent">Enviadas</option><option value="followup">En seguimiento</option>
          <option value="expired">Vencidas</option><option value="accepted">Aceptadas</option>
          <option value="rejected">Rechazadas</option>
        </select>
        <button class="trade-primary" :disabled="locked" @click="create"><Plus :size="16"/> Nueva propuesta</button>
      </div>
      <div v-if="filtered.length" class="trade-table-wrap">
        <table class="trade-table">
          <thead><tr><th>CLIENTE / PROYECTO</th><th>REFERENCIA</th><th>VÁLIDA HASTA</th><th>MONTO</th><th>ESTADO</th><th><span class="trade-sr">Acción</span></th></tr></thead>
          <tbody><tr v-for="q in filtered" :key="q.id" :class="{'trade-table-current':selectedId===q.id}">
            <td><button class="trade-record" @click="selectedId=selectedId===q.id?null:q.id"><strong>{{ q.customer }}</strong><small>{{ q.subject }}</small></button></td>
            <td>{{ q.number }}</td><td>{{ pretty(q.expiresOn) }}</td><td class="trade-money">{{ money(totals(q).total) }}</td>
            <td><span class="trade-status" :class="'trade-status-'+quoteStatus(q)">{{ statuses[quoteStatus(q)] }}</span></td>
            <td><button class="trade-icon" :aria-label="'Abrir '+q.number" @click="selectedId=selectedId===q.id?null:q.id"><ArrowRight :size="18"/></button></td>
          </tr></tbody>
        </table>
      </div>
      <div v-else class="trade-empty"><div class="trade-empty-mark"><MessageSquareText :size="38" :stroke-width="1.3"/></div>
        <h3>{{ store.quotes.length?'No hay cotizaciones con esos filtros.':'Tus propuestas merecen seguimiento.' }}</h3>
        <p>{{ store.quotes.length?'Cambia los filtros para volver a ver tus propuestas.':'Crea tu primera cotización, descarga el PDF y registra cuándo la compartiste con tu cliente.' }}</p>
        <button v-if="!store.quotes.length" class="trade-primary" :disabled="locked" @click="create"><Plus :size="17"/> Crear cotización</button>
        <button v-else class="trade-quiet" @click="query='';filter='all'">Limpiar filtros</button>
      </div>
    </section>

    <section v-if="formOpen" class="trade-panel trade-editor" aria-label="Editor de cotización">
      <header class="trade-panel-head"><div><span class="trade-overline">DOCUMENTO COMERCIAL</span><h2>{{ editing?'Editar cotización':'Nueva cotización' }}</h2></div><button class="trade-icon" aria-label="Cerrar editor" @click="formOpen=false"><X :size="20"/></button></header>
      <form class="trade-form" @submit.prevent="save">
        <label>Número <span>*</span><input v-model="draft.number" maxlength="70" required/></label>
        <label>Cliente o empresa <span>*</span><input v-model="draft.customer" maxlength="120" required placeholder="Ej. Empresa de demostración"/></label>
        <label>Correo (opcional)<input v-model="draft.email" type="email" maxlength="160" placeholder="contacto@ejemplo.cl"/></label>
        <label>Teléfono (opcional)<input v-model="draft.phone" maxlength="30" placeholder="+56 9..."/></label>
        <label class="trade-full">Asunto de la propuesta <span>*</span><input v-model="draft.subject" maxlength="180" required placeholder="Ej. Implementación de sitio web"/></label>
        <label>Fecha de emisión <span>*</span><input v-model="draft.issuedOn" type="date" required/></label>
        <label>Válida hasta <span>*</span><input v-model="draft.expiresOn" type="date" required/></label>
        <label class="trade-full">Impuestos<select v-model="draft.tax"><option value="vat19">Añadir IVA 19% al neto</option><option value="none">Sin IVA aplicado en esta propuesta</option></select></label>
        <div class="trade-full trade-lines">
          <div class="trade-lines-header"><strong>Conceptos</strong><button type="button" class="trade-quiet" :disabled="draft.items.length>=30" @click="addItem"><Plus :size="15"/> Agregar concepto</button></div>
          <div v-for="(item,index) in draft.items" :key="item.id" class="trade-line">
            <label>Descripción <input v-model="item.description" maxlength="150" required placeholder="Servicio o producto"/></label>
            <label>Cantidad<input v-model.number="item.quantity" type="number" min="1" max="10000" step="1" required/></label>
            <label>Unitario CLP<input v-model.number="item.unitPrice" type="number" min="0" max="999999999" step="1" required/></label>
            <button type="button" class="trade-icon" :disabled="draft.items.length===1" :aria-label="'Eliminar concepto '+(index+1)" @click="removeItem(item.id)"><Trash2 :size="16"/></button>
          </div>
          <div class="trade-form-total"><span>Neto {{ money(draftTotals.net) }} <template v-if="draft.tax==='vat19'"> · IVA {{ money(draftTotals.vat) }}</template></span><strong>Total {{ money(draftTotals.total) }}</strong></div>
        </div>
        <label class="trade-full">Condiciones y observaciones<input v-model="draft.notes" maxlength="450" placeholder="Condiciones comerciales, alcance, validez..."/></label>
        <div v-if="formError" class="trade-error trade-full" role="alert">{{ formError }}</div>
        <div class="trade-form-actions"><button type="button" class="trade-quiet" @click="formOpen=false">Cancelar</button><button type="submit" class="trade-primary"><Check :size="17"/> Guardar propuesta</button></div>
      </form>
    </section>

    <section v-if="chosen" class="trade-panel trade-detail">
      <header class="trade-panel-head"><div><span class="trade-overline">FICHA COMERCIAL / {{ chosen.number }}</span><h2>{{ chosen.customer }}</h2><p class="trade-detail-sub">{{ chosen.subject }}</p></div><button class="trade-icon" aria-label="Cerrar detalle" @click="selectedId=null;followupOpen=false"><X :size="20"/></button></header>
      <div class="trade-detail-grid"><div><small>Monto</small><strong>{{ money(totals(chosen).total) }}</strong></div><div><small>Validez</small><strong>{{ pretty(chosen.expiresOn) }}</strong></div><div><small>Estado</small><strong>{{ statuses[quoteStatus(chosen)] }}</strong></div></div>
      <div class="trade-actions">
        <button class="trade-primary" @click="quotePdf(chosen)"><FileDown :size="17"/> Descargar PDF</button>
        <button v-if="chosen.state==='draft'" class="trade-quiet" :disabled="locked" @click="edit(chosen)"><Pencil :size="16"/> Editar</button>
        <button v-if="chosen.state==='draft'" class="trade-quiet" :disabled="locked" @click="change(chosen,'sent','Marcada enviada manualmente')"><Mail :size="16"/> Marcar enviada</button>
        <button v-if="chosen.state==='sent'" class="trade-quiet" :disabled="locked" @click="followupOpen=!followupOpen"><MessageSquareText :size="16"/> Registrar seguimiento</button>
        <button v-if="chosen.state==='sent'" class="trade-quiet" :disabled="locked" @click="change(chosen,'accepted','Confirmación registrada manualmente')"><CheckCheck :size="16"/> Aceptada</button>
        <button v-if="chosen.state==='sent'" class="trade-quiet" :disabled="locked" @click="change(chosen,'rejected','Rechazo registrado manualmente')">Rechazada</button>
        <button v-if="chosen.state!=='draft'" class="trade-quiet" :disabled="locked" @click="change(chosen,'reopened','Edición solicitada')">Reabrir borrador</button>
        <button v-if="!chosen.events.length" class="trade-quiet trade-danger" :disabled="locked" @click="deleteQuote(chosen)"><Trash2 :size="16"/> Eliminar</button>
      </div>
      <form v-if="followupOpen" class="trade-followup" @submit.prevent="recordFollowup">
        <label>Gestión realizada<input v-model="followupNote" minlength="3" maxlength="400" placeholder="Ej. Llamada: solicita nueva revisión de alcance" required/></label>
        <button class="trade-primary" type="submit"><Check :size="16"/> Guardar gestión</button>
      </form>
      <div class="trade-history"><span class="trade-overline">HISTORIAL MANUAL</span>
        <div v-if="!chosen.events.length" class="trade-muted">Todavía no hay eventos registrados.</div>
        <div v-for="e in [...chosen.events].reverse()" :key="e.id" class="trade-history-item"><span class="trade-history-dot"></span><div><strong>{{ eventNames[e.kind] }}</strong><small>{{ pretty(e.at) }} · {{ e.note||'Sin observaciones' }}</small></div></div>
      </div>
    </section>
    <p class="trade-legal">CotizaFollow genera propuestas comerciales. No envía correos, no firma digitalmente y no emite documentos tributarios.</p>
  </div>
</template>
