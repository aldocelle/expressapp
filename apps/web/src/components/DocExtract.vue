<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import {
  ArrowRight, Check, CircleAlert, ClipboardCheck, Download, FileImage,
  FileSearch2, FileText, FolderOpen, ScanText, Search, Trash2, UploadCloud, X
} from 'lucide-vue-next'
import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  canApprove, download, emptyFields, emptyStore, fieldWarnings, MAX_BYTES,
  MAX_ITEMS, MAX_PAGES, parseDocumentText, readStore, recordsCsv, saveStore,
  type DocumentKind, type ExtractRecord, type ExtractStore, type ExtractedFields, typeName
} from '../lib/docextract'
import '../product-lab.css'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker
const loadError = ref('')
let initial = emptyStore()
try { initial = readStore() } catch(err) { loadError.value = err instanceof Error?err.message:'No se pudo abrir la base local.' }
const store = ref<ExtractStore>(initial)
const locked = computed(()=>!!loadError.value)
const processing = ref(false)
const notice = ref('')
const query = ref('')
const statusFilter = ref('all')
const fileInput = ref<HTMLInputElement|null>(null)
const chosenId = ref<string|null>(null)
const previewUrl = ref('')
const previewType = ref('')
const previewId = ref<string|null>(null)
const editFields = reactive<ExtractedFields>(emptyFields())
const editKind = ref<DocumentKind>('factura')
const chosen = computed(()=>store.value.records.find(x=>x.id===chosenId.value)??null)
const reviewedCount = computed(()=>store.value.records.filter(x=>x.reviewed).length)
const filtered = computed(()=>store.value.records.filter(x=>{
  const text=[x.filename,x.fields.issuer,x.fields.rut,x.fields.folio].join(' ').toLocaleLowerCase('es')
  return text.includes(query.value.toLocaleLowerCase('es')) && (statusFilter.value==='all'||(statusFilter.value==='reviewed'?x.reviewed:!x.reviewed))
}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)))
const warnings = computed(()=>fieldWarnings(editFields))
function persist(value:ExtractStore):boolean{
  if(locked.value)return false
  try{saveStore(value);store.value=value;notice.value='';return true}
  catch(err){notice.value=err instanceof Error?err.message:'No se pudo guardar.';return false}
}
function clearPreview(){
  if(previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value='';previewId.value=null;previewType.value=''
}
onBeforeUnmount(clearPreview)
function select(record:ExtractRecord){
  chosenId.value=record.id
  Object.assign(editFields,record.fields)
  editKind.value=record.kind
}
async function processFile(event:Event){
  const input=event.target as HTMLInputElement
  const file=input.files?.[0]
  input.value=''
  if(!file||processing.value||locked.value)return
  if(store.value.records.length>=MAX_ITEMS){notice.value='Límite local de '+MAX_ITEMS+' registros. Elimina registros antes de continuar.';return}
  if(file.size>MAX_BYTES){notice.value='El archivo supera el máximo de 10 MB.';return}
  const isPdf=file.type==='application/pdf'
  const isImage=file.type==='image/jpeg'||file.type==='image/png'
  if(!isPdf&&!isImage){notice.value='Usa PDF, JPG o PNG.';return}
  processing.value=true;notice.value=''
  let extracted='',pages=0
  try{
    if(isPdf){
      const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())})
      try{
        const doc=await task.promise
        if(doc.numPages>MAX_PAGES)throw new Error('El PDF excede el máximo de 30 páginas.')
        pages=doc.numPages
        const fragments:string[]=[]
        for(let pageNumber=1;pageNumber<=doc.numPages;pageNumber++){
          const page=await doc.getPage(pageNumber)
          const content=await page.getTextContent()
          fragments.push(content.items.map(item=>'str' in item
            ? item.str+(item.hasEOL?'\n':' ')
            : '').join(''))
        }
        extracted=fragments.join('\n')
      } finally { await task.destroy() }
    }
    const mode=extracted.trim()?'pdf-text':'manual'
    const record:ExtractRecord={
      id:crypto.randomUUID(),filename:file.name,bytes:file.size,
      kind:'factura', mode, pages, fields:mode==='pdf-text'?parseDocumentText(extracted):emptyFields(),
      snippet:extracted.trim().slice(0,3500), reviewed:false,createdAt:new Date().toISOString()
    }
    if(persist({...store.value,records:[record,...store.value.records]})){
      clearPreview()
      previewUrl.value=URL.createObjectURL(file)
      previewId.value=record.id
      previewType.value=isPdf?'pdf':'image'
      select(record)
      if(mode==='manual')notice.value=isPdf
        ? 'Este PDF no contiene texto seleccionable. Requiere OCR externo o ingreso manual.'
        : 'Las imágenes requieren OCR externo. Puedes ingresar sus campos manualmente.'
      else notice.value='Texto extraído del PDF localmente. Revisa los valores antes de aprobarlos.'
    }
  }catch(err){
    notice.value=err instanceof Error?err.message:'No se pudo procesar el documento.'
  }finally{processing.value=false}
}
function saveReview(approve:boolean){
  const record=chosen.value
  if(!record||locked.value)return
  const next:ExtractRecord={...record,kind:editKind.value,fields:{...editFields},reviewed:approve}
  if(approve){
    const error=canApprove(next)
    if(error){notice.value=error;return}
  }
  persist({...store.value,records:store.value.records.map(r=>r.id===next.id?next:r)})
}
function remove(record:ExtractRecord){
  if(locked.value)return
  if(!window.confirm('¿Eliminar el registro "'+record.filename+'"? No se puede recuperar.'))return
  if(persist({...store.value,records:store.value.records.filter(x=>x.id!==record.id)})){
    if(chosenId.value===record.id)chosenId.value=null
    if(previewId.value===record.id)clearPreview()
  }
}
function exportJSON(){
  const data=store.value.records.map(({id,filename,kind,mode,pages,fields,reviewed,createdAt})=>({
    id,filename,kind,mode,pages,fields,reviewed,createdAt
  }))
  download(JSON.stringify(data,null,2),'docextract-datos.json','application/json;charset=utf-8')
}
const fieldList:{key:keyof ExtractedFields;label:string;hint:string}[]=[
  {key:'issuer',label:'Emisor / Razón social',hint:'Ej. Empresa SpA'},
  {key:'rut',label:'RUT del emisor',hint:'12.345.678-5'},
  {key:'folio',label:'Folio / Número',hint:'Ej. 001234'},
  {key:'date',label:'Fecha de emisión',hint:'AAAA-MM-DD'},
  {key:'dueDate',label:'Fecha de vencimiento',hint:'AAAA-MM-DD'},
  {key:'net',label:'Neto (CLP)',hint:'Número entero, sin puntos'},
  {key:'iva',label:'IVA (CLP)',hint:'Número entero, sin puntos'},
  {key:'total',label:'Total (CLP)',hint:'Número entero, sin puntos'},
  {key:'recipient',label:'Receptor / Cliente',hint:'Opcional'},
]
</script>

<template>
  <div class="pl pl-docs">
    <div class="pl-hero">
      <div class="pl-hero-copy">
        <div class="pl-eyebrow"><span class="pl-monogram">DE</span> EXPRESSAPPS / DOCUMENTOS</div>
        <h1>Doc<span>Extract.</span></h1>
        <p>El dato importa.<br>El documento también.</p>
        <button class="pl-hero-cta" :disabled="locked||processing||store.records.length>=MAX_ITEMS" @click="fileInput?.click()">
          <UploadCloud :size="17"/> {{ processing?'Procesando...':'Importar documento' }} <ArrowRight :size="17"/>
        </button>
        <input ref="fileInput" class="pl-hidden-input" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" aria-label="Seleccionar PDF, JPG o PNG" @change="processFile"/>
      </div>
      <div class="pl-hero-stat">
        <span>DOCUMENTOS REVISADOS</span>
        <strong>{{ reviewedCount }} <small>/ {{ store.records.length }}</small></strong>
        <p>Extracción de texto PDF local. Imágenes y escaneos requieren ingreso manual en esta versión.</p>
        <div class="pl-pattern" aria-hidden="true"><ScanText :size="136" :stroke-width="0.8"/></div>
      </div>
    </div>

    <div class="pl-alert"><CircleAlert :size="19"/><span><strong>Laboratorio documental local.</strong> No hay OCR de imágenes, validación tributaria ni servidor. Los archivos originales no se almacenan; solo los campos extraídos y un fragmento de texto quedan en el navegador. No subas documentos confidenciales.</span></div>
    <div v-if="loadError" class="pl-error" role="alert">{{ loadError }} Escritura bloqueada para conservar los registros.</div>
    <div v-if="notice" class="pl-message" role="status">{{ notice }} <button aria-label="Cerrar aviso" @click="notice=''"><X :size="15"/></button></div>
    <div class="pl-metrics">
      <div><span><FolderOpen :size="17"/> Registros locales</span><strong>{{ store.records.length }}</strong><small>Máximo {{ MAX_ITEMS }} en este navegador</small></div>
      <div><span><ClipboardCheck :size="17"/> Revisados</span><strong>{{ reviewedCount }}</strong><small>Verificados por el usuario</small></div>
      <div><span><FileText :size="17"/> Pendientes</span><strong>{{ store.records.length-reviewedCount }}</strong><small>Corrección humana pendiente</small></div>
      <div><span><FileSearch2 :size="17"/> Con texto PDF</span><strong>{{ store.records.filter(r=>r.mode==='pdf-text').length }}</strong><small>Sin OCR externo</small></div>
    </div>

    <div class="pl-doc-layout">
      <section class="pl-sheet">
        <div class="pl-section-head">
          <div><span class="pl-overline">BIBLIOTECA LOCAL</span><h2>Mis documentos <em>{{ store.records.length }}</em></h2></div>
          <div class="pl-head-actions">
            <button class="pl-ghost" :disabled="!store.records.length" @click="download(recordsCsv(store.records),'docextract-datos.csv','text/csv;charset=utf-8')"><Download :size="16"/> CSV</button>
            <button class="pl-ghost" :disabled="!store.records.length" @click="exportJSON"><Download :size="16"/> JSON</button>
          </div>
        </div>
        <div class="pl-toolbar">
          <label class="pl-search"><Search :size="17"/><input v-model="query" aria-label="Buscar documentos" placeholder="Archivo, emisor, RUT, folio..."/></label>
          <select v-model="statusFilter" aria-label="Filtrar documentos">
            <option value="all">Todos los estados</option><option value="reviewed">Revisados</option><option value="pending">Sin revisar</option>
          </select>
        </div>
        <div v-if="filtered.length" class="pl-doc-list">
          <div v-for="r in filtered" :key="r.id" class="pl-doc-item" :class="{'pl-selected':chosenId===r.id}">
            <button class="pl-doc-open" :aria-label="'Revisar '+r.filename" @click="select(r)">
              <span class="pl-doc-icon"><FileText v-if="r.pages" :size="22"/><FileImage v-else :size="22"/></span>
              <span class="pl-doc-names"><strong>{{ r.filename }}</strong><small>{{ typeName[r.kind] }} · {{ r.mode==='pdf-text'?'Texto extraído':'Ingreso manual' }}</small></span>
              <span class="pl-state" :class="r.reviewed?'pl-state-active':'pl-state-due-soon'">{{ r.reviewed?'Revisado':'Revisar' }}</span>
              <ArrowRight :size="17"/>
            </button>
            <button class="pl-icon-btn" :disabled="locked" :aria-label="'Eliminar '+r.filename" @click="remove(r)"><Trash2 :size="16"/></button>
          </div>
        </div>
        <div v-else class="pl-empty">
          <ScanText :size="39" :stroke-width="1.5"/>
          <h3>{{ store.records.length?'Sin coincidencias':'Convierte archivos en información.' }}</h3>
          <p>{{ store.records.length?'Ajusta la búsqueda o el filtro.':'Carga un PDF con texto y revisa los campos detectados. Las imágenes se pueden registrar manualmente.' }}</p>
          <button v-if="!store.records.length" class="pl-primary" :disabled="locked||processing" @click="fileInput?.click()"><UploadCloud :size="17"/> Importar primer archivo</button>
          <button v-else class="pl-ghost" @click="query='';statusFilter='all'">Limpiar filtros</button>
        </div>
      </section>

      <section class="pl-doc-review" aria-label="Revisión de documento">
        <template v-if="chosen">
          <div class="pl-review-head"><span class="pl-overline">INSPECTOR DE DOCUMENTO</span><strong>{{ chosen.filename }}</strong><small>{{ chosen.pages?chosen.pages+' páginas · ':'' }}{{ (chosen.bytes/1024).toFixed(0) }} KB</small></div>
          <div class="pl-document-stage">
            <template v-if="previewId===chosen.id&&previewUrl">
              <iframe v-if="previewType==='pdf'" :src="previewUrl" title="Vista previa temporal del PDF original"></iframe>
              <img v-else :src="previewUrl" :alt="'Vista previa de '+chosen.filename"/>
            </template>
            <div v-else class="pl-no-preview"><FileSearch2 :size="38" :stroke-width="1.2"/><strong>Archivo original no disponible</strong><p>La vista previa solo existe durante la sesión de carga. Los originales nunca se guardan en el navegador.</p></div>
          </div>
          <p v-if="chosen.mode==='manual'" class="pl-doc-hint">Sin extracción automática disponible para este archivo. Ingresa los campos a continuación.</p>
          <p v-else class="pl-doc-hint">Extracción heurística de texto seleccionable. Comprueba cada campo con el PDF original.</p>
          <div class="pl-review-fields">
            <label>Tipo de documento<select v-model="editKind"><option v-for="(label,key) in typeName" :key="key" :value="key">{{ label }}</option></select></label>
            <label v-for="f in fieldList" :key="f.key">{{ f.label }}<input v-model="editFields[f.key]" :placeholder="f.hint" maxlength="120"/></label>
          </div>
          <div v-if="warnings.length" class="pl-warning-list" role="alert"><strong>Hay datos que necesitan revisión:</strong><p v-for="w in warnings" :key="w">{{ w }}</p></div>
          <div class="pl-review-actions">
            <button class="pl-ghost" :disabled="locked" @click="saveReview(false)">Guardar borrador</button>
            <button class="pl-primary" :disabled="locked" @click="saveReview(true)"><Check :size="17"/> Guardar y marcar revisado</button>
          </div>
          <details v-if="chosen.snippet" class="pl-snippet"><summary>Mostrar fragmento extraído del PDF</summary><pre>{{ chosen.snippet }}</pre></details>
        </template>
        <div v-else class="pl-inspector-empty"><FileSearch2 :size="48" :stroke-width="1.2"/><h3>Una fuente.<br>Datos verificables.</h3><p>Selecciona un archivo de la biblioteca para revisar, corregir y exportar sus campos.</p></div>
      </section>
    </div>
    <p class="pl-legal">No se consultan servicios del SII. La extracción es orientativa y requiere verificación humana antes de utilizar datos en procesos contables o tributarios.</p>
  </div>
</template>
