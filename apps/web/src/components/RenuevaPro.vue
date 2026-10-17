<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  ArrowRight, CalendarClock, Check, CheckCircle2, CircleAlert, Clock3, Download,
  History, Pause, Pencil, Plus, Repeat2, RotateCcw, Search, Trash2, X
} from 'lucide-vue-next'
import {
  cadenceLabel, cadences, daysInMonth, emptyRenewals, equivalentMRR, exportCsv,
  isoLocal, money, newContract, parseDay, prettyDate, readRenewals, relativeDays,
  renew, renewalCsv, renewalStatus, saveRenewals, summary, validateContract,
  type Cadence, type Contract, type RenewalStore
} from '../lib/renuevapro'
import '../product-lab.css'

let initial = emptyRenewals()
const loadError = ref('')
try { initial = readRenewals() } catch (err) { loadError.value = err instanceof Error ? err.message : 'Error leyendo los registros.' }
const store = ref<RenewalStore>(initial)
const locked = computed(() => !!loadError.value)
const notice = ref('')
const editing = ref<string | null>(null)
const formOpen = ref(false)
const formError = ref('')
const filter = ref('all')
const query = ref('')
const selectedId = ref<string | null>(null)
const today = isoLocal()
const draft = reactive({ customer: '', service: '', amount: 0, startsOn: today, nextOn: today, cadence: 'monthly' as Cadence, note: '' })
const selected = computed(() => store.value.contracts.find(x => x.id === selectedId.value) ?? null)
const numbers = computed(() => summary(store.value.contracts))
const states: Record<string,string> = {
  active: 'Vigente', 'due-soon': 'Por renovar', overdue: 'Atrasada', paused: 'Pausada', cancelled: 'Cancelada'
}
const filtered = computed(() => store.value.contracts.filter(c => {
  const text = [c.customer,c.service,c.note].join(' ').toLocaleLowerCase('es')
  const matches = text.includes(query.value.toLocaleLowerCase('es'))
  return matches && (filter.value === 'all' || filter.value === renewalStatus(c))
}).sort((a,b)=>a.nextOn.localeCompare(b.nextOn)))
const dueList = computed(() => store.value.contracts.filter(c=>c.state === 'active').sort((a,b)=>a.nextOn.localeCompare(b.nextOn)).slice(0,5))

function persist(value: RenewalStore): boolean {
  if (locked.value) return false
  try { saveRenewals(value); store.value = value; notice.value=''; return true }
  catch(err) { notice.value = err instanceof Error ? err.message : 'No fue posible guardar.'; return false }
}
function openCreate() {
  Object.assign(draft,{customer:'',service:'',amount:0,startsOn:today,nextOn:today,cadence:'monthly',note:''})
  editing.value = null; formError.value=''; formOpen.value=true
}
function openEdit(c: Contract) {
  Object.assign(draft,{customer:c.customer,service:c.service,amount:c.amount,startsOn:c.startsOn,nextOn:c.nextOn,cadence:c.cadence,note:c.note})
  editing.value=c.id;formError.value='';formOpen.value=true
}
function save() {
  const payload = {
    customer:draft.customer.trim(),service:draft.service.trim(),amount:Number(draft.amount),
    startsOn:draft.startsOn,nextOn:draft.nextOn,cadence:draft.cadence,note:draft.note.trim()
  }
  const error=validateContract(payload)
  if(error) {formError.value=error;return}
  const original=store.value.contracts.find(c=>c.id===editing.value)
  let contracts: Contract[]
  if(original) {
    const nextParts=parseDay(payload.nextOn)!
    const changedDate=original.nextOn !== payload.nextOn
    const edited: Contract={...original,...payload,
      anchorDay:changedDate ? nextParts.d : original.anchorDay,
      monthEnd:changedDate ? nextParts.d===daysInMonth(nextParts.y,nextParts.m) : original.monthEnd}
    contracts=store.value.contracts.map(c=>c.id===original.id?edited:c)
  } else {
    contracts=[newContract(payload), ...store.value.contracts]
  }
  if(persist({...store.value,contracts})) formOpen.value=false
}
function changeState(c: Contract, state: Contract['state']) {
  if(locked.value) return
  const next={...store.value,contracts:store.value.contracts.map(x=>x.id===c.id?{...x,state}:x)}
  persist(next)
}
function renewOne(c: Contract) {
  if(locked.value)return
  if(!window.confirm('¿Confirmas que este servicio fue renovado? La próxima fecha avanzará un período.'))return
  try{
    const updated=renew(c)
    persist({...store.value,contracts:store.value.contracts.map(x=>x.id===c.id?updated:x)})
  }catch(err){notice.value=err instanceof Error?err.message:'No se pudo renovar.'}
}
function remove(c:Contract){
  if(locked.value)return
  if(c.history.length){notice.value='Un servicio con renovaciones registradas no se elimina en esta demo. Puedes cancelarlo.';return}
  if(!window.confirm('¿Eliminar definitivamente el servicio de '+c.customer+'?'))return
  if(persist({...store.value,contracts:store.value.contracts.filter(x=>x.id!==c.id)})){
    if(selectedId.value===c.id)selectedId.value=null
  }
}
</script>

<template>
  <div class="pl pl-renew">
    <div class="pl-hero">
      <div class="pl-hero-copy">
        <div class="pl-eyebrow"><span class="pl-monogram">RP</span> EXPRESSAPPS / OPERACIONES</div>
        <h1>Renueva<span>Pro.</span></h1>
        <p>Los contratos pasan.<br>Las relaciones continúan.</p>
        <button class="pl-hero-cta" :disabled="locked" @click="openCreate"><Plus :size="17"/> Nuevo servicio <ArrowRight :size="17"/></button>
      </div>
      <div class="pl-hero-stat">
        <span>VALOR RECURRENTE MENSUAL ESTIMADO</span>
        <strong>{{ money(equivalentMRR(store.contracts)) }}</strong>
        <p>Equivalente mensual de contratos activos. No representa facturación ni pagos recibidos.</p>
        <div class="pl-pattern" aria-hidden="true"><Repeat2 :size="136" :stroke-width="0.8"/></div>
      </div>
    </div>

    <div class="pl-alert"><CircleAlert :size="19"/><span><strong>Demo local.</strong> Los contratos permanecen solo en este navegador. Los avisos y renovaciones no se envían ni se ejecutan automáticamente. No utilices información contractual confidencial.</span></div>
    <div v-if="loadError" class="pl-error" role="alert">{{ loadError }}. Edición bloqueada para proteger los datos.</div>
    <div v-if="notice" class="pl-error" role="alert">{{ notice }} <button aria-label="Cerrar aviso" @click="notice=''"><X :size="15"/></button></div>

    <div class="pl-metrics">
      <div><span><Repeat2 :size="17"/> Servicios activos</span><strong>{{ numbers.active }}</strong><small>Contratos no pausados ni cancelados</small></div>
      <div><span><Clock3 :size="17"/> Próximos 30 días</span><strong>{{ numbers.soon }}</strong><small>Renovaciones previstas</small></div>
      <div><span><CircleAlert :size="17"/> Atrasadas</span><strong>{{ numbers.overdue }}</strong><small>Revisar antes de avanzar ciclo</small></div>
      <div><span><CalendarClock :size="17"/> Valor a renovar</span><strong>{{ money(numbers.dueAmount) }}</strong><small>Incluye fechas atrasadas</small></div>
    </div>

    <div class="pl-renew-layout">
      <section class="pl-sheet">
        <div class="pl-section-head">
          <div><span class="pl-overline">CARTERA COMERCIAL</span><h2>Servicios recurrentes <em>{{ store.contracts.length }}</em></h2></div>
          <button class="pl-ghost" :disabled="!store.contracts.length" @click="exportCsv(renewalCsv(store))"><Download :size="16"/> Exportar CSV</button>
        </div>
        <div class="pl-toolbar">
          <label class="pl-search"><Search :size="17"/><input v-model="query" placeholder="Buscar cliente o servicio" aria-label="Buscar servicios"/></label>
          <select v-model="filter" aria-label="Filtrar por estado">
            <option value="all">Todos los estados</option>
            <option value="active">Vigentes</option><option value="due-soon">Por renovar</option>
            <option value="overdue">Atrasadas</option><option value="paused">Pausadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>
        <div v-if="filtered.length" class="pl-table-wrap">
          <table class="pl-table">
            <thead><tr><th>CLIENTE / SERVICIO</th><th>VALOR / CICLO</th><th>PRÓXIMA FECHA</th><th>ESTADO</th><th>DETALLE</th></tr></thead>
            <tbody><tr v-for="c in filtered" :key="c.id" :class="{ 'pl-selected': c.id===selectedId }">
              <td><strong>{{ c.customer }}</strong><small>{{ c.service }}</small></td>
              <td><strong>{{ money(c.amount) }}</strong><small>{{ cadenceLabel[c.cadence] }}</small></td>
              <td>{{ prettyDate(c.nextOn) }}</td>
              <td><span class="pl-state" :class="'pl-state-'+renewalStatus(c)">{{ states[renewalStatus(c)] }}</span></td>
              <td><button class="pl-icon-btn" :aria-label="'Detalle de '+c.service" @click="selectedId=selectedId===c.id?null:c.id"><ArrowRight :size="18"/></button></td>
            </tr></tbody>
          </table>
        </div>
        <div v-else class="pl-empty">
          <Repeat2 :size="37" :stroke-width="1.4"/>
          <h3>{{ store.contracts.length?'Sin coincidencias':'Tu continuidad comercial empieza aquí.' }}</h3>
          <p>{{ store.contracts.length?'Prueba con otros filtros.':'Registra servicios que se renuevan periódicamente y controla las fechas.' }}</p>
          <button v-if="!store.contracts.length" class="pl-primary" :disabled="locked" @click="openCreate"><Plus :size="17"/> Registrar servicio</button>
          <button v-else class="pl-ghost" @click="query='';filter='all'">Limpiar filtros</button>
        </div>
      </section>

      <aside class="pl-timeline">
        <div class="pl-overline">PRÓXIMAS FECHAS</div>
        <h2>En el radar.</h2>
        <div v-if="dueList.length" class="pl-timeline-items">
          <div v-for="c in dueList" :key="c.id" class="pl-milestone">
            <span class="pl-milestone-date">{{ prettyDate(c.nextOn) }}</span>
            <strong>{{ c.customer }}</strong><small>{{ c.service }}</small>
            <span :class="{late:relativeDays(c.nextOn)<0}">{{ relativeDays(c.nextOn)<0?'Atrasada '+(-relativeDays(c.nextOn))+' días':relativeDays(c.nextOn)===0?'Hoy':'En '+relativeDays(c.nextOn)+' días' }}</span>
          </div>
        </div>
        <p v-else class="pl-muted">No hay renovaciones activas por ordenar.</p>
        <div class="pl-timeline-footer"><CalendarClock :size="19"/><span>Un calendario de control, no un sistema de cobros ni notificaciones.</span></div>
      </aside>
    </div>

    <section v-if="formOpen" class="pl-sheet pl-editor" aria-label="Formulario de servicio">
      <div class="pl-section-head"><div><span class="pl-overline">OPERACIÓN MANUAL</span><h2>{{ editing?'Editar servicio':'Nuevo servicio recurrente' }}</h2></div><button class="pl-icon-btn" aria-label="Cerrar formulario" @click="formOpen=false"><X :size="19"/></button></div>
      <form class="pl-form" @submit.prevent="save">
        <label>Cliente <span>*</span><input v-model="draft.customer" required maxlength="120" placeholder="Ej. Empresa de demostración"/></label>
        <label>Servicio <span>*</span><input v-model="draft.service" required maxlength="120" placeholder="Ej. Mantención mensual"/></label>
        <label>Importe por período (CLP) <span>*</span><input v-model.number="draft.amount" type="number" required min="1" max="999999999999" step="1" /></label>
        <label>Periodicidad <span>*</span><select v-model="draft.cadence"><option v-for="item in cadences" :key="item" :value="item">{{ cadenceLabel[item] }}</option></select></label>
        <label>Inicio del servicio <span>*</span><input v-model="draft.startsOn" type="date" required/></label>
        <label>Próxima renovación <span>*</span><input v-model="draft.nextOn" type="date" required/></label>
        <label class="pl-full">Notas<input v-model="draft.note" maxlength="300" placeholder="Condiciones de renovación, referencia o contacto"/></label>
        <div v-if="formError" class="pl-error pl-full" role="alert">{{ formError }}</div>
        <div class="pl-form-actions"><button type="button" class="pl-ghost" @click="formOpen=false">Cancelar</button><button type="submit" class="pl-primary"><Check :size="17"/> Guardar servicio</button></div>
      </form>
    </section>

    <section v-if="selected" class="pl-sheet pl-detail" aria-label="Detalle del contrato">
      <div class="pl-section-head"><div><span class="pl-overline">FICHA DEL SERVICIO</span><h2>{{ selected.customer }} · {{ selected.service }}</h2></div><button class="pl-icon-btn" aria-label="Cerrar detalle" @click="selectedId=null"><X :size="19"/></button></div>
      <div class="pl-detail-values">
        <div><small>Valor por período</small><strong>{{ money(selected.amount) }}</strong></div>
        <div><small>Frecuencia</small><strong>{{ cadenceLabel[selected.cadence] }}</strong></div>
        <div><small>Próxima renovación</small><strong>{{ prettyDate(selected.nextOn) }}</strong></div>
        <div><small>Renovaciones registradas</small><strong>{{ selected.history.length }}</strong></div>
      </div>
      <p v-if="selected.note" class="pl-muted">{{ selected.note }}</p>
      <div class="pl-actions">
        <button class="pl-primary" :disabled="locked||selected.state!=='active'" @click="renewOne(selected)"><CheckCircle2 :size="17"/> Confirmar renovación</button>
        <button class="pl-ghost" :disabled="locked" @click="openEdit(selected)"><Pencil :size="16"/> Editar</button>
        <button v-if="selected.state==='active'" class="pl-ghost" :disabled="locked" @click="changeState(selected,'paused')"><Pause :size="16"/> Pausar</button>
        <button v-else-if="selected.state==='paused'" class="pl-ghost" :disabled="locked" @click="changeState(selected,'active')"><RotateCcw :size="16"/> Reanudar</button>
        <button v-if="selected.state!=='cancelled'" class="pl-ghost" :disabled="locked" @click="changeState(selected,'cancelled')">Cancelar servicio</button>
        <button v-else class="pl-ghost" :disabled="locked" @click="changeState(selected,'active')">Reactivar</button>
        <button class="pl-ghost pl-danger" :disabled="locked||!!selected.history.length" @click="remove(selected)"><Trash2 :size="16"/> Eliminar</button>
      </div>
      <div class="pl-history">
        <div class="pl-overline"><History :size="15"/> HISTORIAL DE RENOVACIONES</div>
        <p v-if="!selected.history.length" class="pl-muted">Aún no hay renovaciones confirmadas.</p>
        <div v-for="h in [...selected.history].reverse()" :key="h.id" class="pl-history-item">
          <CheckCircle2 :size="18"/><span>Confirmada el {{ prettyDate(h.at) }}</span><strong>{{ prettyDate(h.previousDate) }} → {{ prettyDate(h.nextDate) }}</strong>
        </div>
      </div>
    </section>
    <p class="pl-legal">Los valores son contractuales estimados. RenuevaPro no factura ni ejecuta pagos automáticamente.</p>
  </div>
</template>
