<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  ArrowDownLeft, ArrowRight, Banknote, Check, ChevronDown, CircleAlert,
  Download, FilePlus2, HandCoins, Landmark, Pencil, Plus, ReceiptText,
  Search, ShieldAlert, Trash2, UserRound, UsersRound, Wallet, X
} from 'lucide-vue-next'
import {
  aging, balance, dateDiff, downloadCsv, EMPTY_LEDGER, isValidAmount, isValidDate,
  money, overview, paymentTotal, paymentsCsv, readLedger, receivablesCsv,
  saveLedger, status, validatePayment, validateReceivable,
  type Customer, type Ledger, type Receivable
} from '../lib/cobrolisto'
import '../cobrolisto.css'

const loadError = ref('')
let initial: Ledger = EMPTY_LEDGER()
try { initial = readLedger() } catch (error) {
  loadError.value = error instanceof Error ? error.message : 'No se pudieron leer los datos locales.'
}
const ledger = ref<Ledger>(initial)
const locked = ref(Boolean(loadError.value))
const message = ref('')
const tab = ref<'accounts' | 'customers'>('accounts')
const search = ref('')
const filter = ref('todas')
const editor = ref<'account' | 'customer' | null>(null)
const editingId = ref<string | null>(null)
const selectedId = ref<string | null>(null)
const formError = ref('')
const paymentError = ref('')
const paymentOpen = ref(false)

const localDate = () => {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}
const draft = reactive({ customerId: '', reference: '', concept: '', amount: 0, issuedOn: localDate(), dueOn: localDate() })
const client = reactive({ name: '', email: '', phone: '' })
const payment = reactive({ amount: 0, date: localDate(), note: '' })

const stats = computed(() => overview(ledger.value.receivables))
const buckets = computed(() => aging(ledger.value.receivables))
const totalAging = computed(() => Object.values(buckets.value).reduce((a, b) => a + b, 0))
const aged = computed(() => buckets.value.d1to30 + buckets.value.d31to60 + buckets.value.d61to90 + buckets.value.over90)
const recordCount = computed(() => ledger.value.receivables.length)
const chosen = computed(() => ledger.value.receivables.find(x => x.id === selectedId.value) ?? null)
const customerById = (id: string) => ledger.value.customers.find(x => x.id === id)
const statuses: Record<string, string> = {
  pendiente: 'Pendiente', 'por-vencer': 'Por vencer', vencida: 'Vencida',
  parcial: 'Abono parcial', pagada: 'Pagada', 'en-disputa': 'En disputa', anulada: 'Anulada'
}
const visible = computed(() => [...ledger.value.receivables].filter(r => {
  const name = customerById(r.customerId)?.name ?? ''
  const q = search.value.trim().toLocaleLowerCase('es')
  const matchesText = [name, r.reference, r.concept].some(s => s.toLocaleLowerCase('es').includes(q))
  const matchesFilter = filter.value === 'todas' || (filter.value === 'abiertas'
    ? !r.cancelled && balance(r) > 0
    : filter.value === 'vencidas'
    ? !r.cancelled && balance(r) > 0 && dateDiff(r.dueOn) < 0
    : status(r) === filter.value)
  return matchesText && matchesFilter
}).sort((a, b) => a.dueOn.localeCompare(b.dueOn)))

function commit(next: Ledger): boolean {
  if (locked.value) return false
  try {
    saveLedger(next)
    ledger.value = next
    message.value = ''
    return true
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'No se pudieron guardar los cambios.'
    return false
  }
}

function newAccount() {
  if (locked.value) return
  if (!ledger.value.customers.length) { tab.value = 'customers'; newCustomer(); return }
  Object.assign(draft, { customerId: ledger.value.customers[0].id, reference: '', concept: '', amount: 0,
    issuedOn: localDate(), dueOn: localDate() })
  editingId.value = null
  formError.value = ''
  editor.value = 'account'
  tab.value = 'accounts'
}
function editAccount(r: Receivable) {
  if (locked.value) return
  Object.assign(draft, {
    customerId: r.customerId, reference: r.reference, concept: r.concept,
    amount: r.amount, issuedOn: r.issuedOn, dueOn: r.dueOn
  })
  editingId.value = r.id
  formError.value = ''
  editor.value = 'account'
  tab.value = 'accounts'
}
function saveAccount() {
  const amount = Number(draft.amount)
  const payload = {
    customerId: draft.customerId, reference: draft.reference.trim(),
    concept: draft.concept.trim(), issuedOn: draft.issuedOn, dueOn: draft.dueOn, amount
  }
  const error = validateReceivable(payload)
  if (error) { formError.value = error; return }
  if (!ledger.value.customers.some(c => c.id === payload.customerId)) {
    formError.value = 'El cliente seleccionado no existe.'; return
  }
  const original = ledger.value.receivables.find(x => x.id === editingId.value)
  if (original && amount < paymentTotal(original)) {
    formError.value = 'El total no puede ser inferior a los abonos ya registrados.'; return
  }
  const next: Ledger = {
    ...ledger.value,
    receivables: original
      ? ledger.value.receivables.map(x => x.id === original.id ? { ...x, ...payload } : x)
      : [{ id: crypto.randomUUID(), ...payload, payments: [], cancelled: false, disputed: false,
        createdAt: new Date().toISOString() }, ...ledger.value.receivables]
  }
  if (commit(next)) editor.value = null
}
function newCustomer() {
  if (locked.value) return
  Object.assign(client, { name: '', email: '', phone: '' })
  editingId.value = null
  formError.value = ''
  editor.value = 'customer'
  tab.value = 'customers'
}
function editCustomer(c: Customer) {
  if (locked.value) return
  Object.assign(client, { name: c.name, email: c.email, phone: c.phone })
  editingId.value = c.id
  formError.value = ''
  editor.value = 'customer'
  tab.value = 'customers'
}
function saveCustomer() {
  if (client.name.trim().length < 2) { formError.value = 'Ingresa un nombre de al menos dos caracteres.'; return }
  if (client.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email.trim())) {
    formError.value = 'Revisa el formato del correo electrónico.'; return
  }
  const payload = { name: client.name.trim(), email: client.email.trim(), phone: client.phone.trim() }
  const original = ledger.value.customers.find(x => x.id === editingId.value)
  const next: Ledger = {
    ...ledger.value,
    customers: original
      ? ledger.value.customers.map(c => c.id === original.id ? { ...c, ...payload } : c)
      : [...ledger.value.customers, { id: crypto.randomUUID(), ...payload, createdAt: new Date().toISOString() }]
  }
  if (commit(next)) editor.value = null
}
function deleteCustomer(c: Customer) {
  if (ledger.value.receivables.some(r => r.customerId === c.id)) {
    message.value = 'No puedes eliminar clientes con cuentas registradas. Conserva su historial.'; return
  }
  if (!window.confirm('¿Eliminar al cliente "' + c.name + '"?')) return
  commit({ ...ledger.value, customers: ledger.value.customers.filter(x => x.id !== c.id) })
}
function selectAccount(r: Receivable) {
  selectedId.value = selectedId.value === r.id ? null : r.id
  paymentOpen.value = false
  paymentError.value = ''
  editor.value = null
}
function startPayment() {
  if (!chosen.value || locked.value || chosen.value.cancelled || balance(chosen.value) === 0) return
  Object.assign(payment, { amount: balance(chosen.value), date: localDate(), note: '' })
  paymentError.value = ''
  paymentOpen.value = true
}
function savePayment() {
  if (!chosen.value) return
  const amount = Number(payment.amount)
  const error = validatePayment(chosen.value, amount, payment.date)
  if (error) { paymentError.value = error; return }
  const id = chosen.value.id
  const next: Ledger = { ...ledger.value, receivables: ledger.value.receivables.map(r =>
    r.id === id ? { ...r, payments: [...r.payments, {
      id: crypto.randomUUID(), amount, date: payment.date, note: payment.note.trim(),
      createdAt: new Date().toISOString()
    }] } : r) }
  if (commit(next)) paymentOpen.value = false
}
function removePayment(record: Receivable, id: string) {
  if (locked.value) return
  if (!window.confirm('¿Eliminar este abono? El saldo pendiente volverá a aumentar.')) return
  commit({ ...ledger.value, receivables: ledger.value.receivables.map(r =>
    r.id === record.id ? { ...r, payments: r.payments.filter(p => p.id !== id) } : r) })
}
function changeDispute(record: Receivable) {
  if (locked.value || record.cancelled || balance(record) === 0) return
  commit({ ...ledger.value, receivables: ledger.value.receivables.map(r =>
    r.id === record.id ? { ...r, disputed: !r.disputed } : r) })
}
function cancelAccount(record: Receivable) {
  if (locked.value) return
  if (record.payments.length) {
    message.value = 'Una cuenta con abonos no puede anularse desde esta demo. Corrige primero los pagos registrados.'; return
  }
  if (!window.confirm(record.cancelled ? '¿Reactivar esta cuenta?' : '¿Anular esta cuenta por cobrar?')) return
  commit({ ...ledger.value, receivables: ledger.value.receivables.map(r =>
    r.id === record.id ? { ...r, cancelled: !r.cancelled, disputed: false } : r) })
}
function deleteAccount(record: Receivable) {
  if (locked.value) return
  if (record.payments.length) {
    message.value = 'No es posible eliminar cuentas con abonos. Esta restricción conserva el historial local.'; return
  }
  if (!window.confirm('¿Eliminar definitivamente "' + record.reference + '"?')) return
  if (commit({ ...ledger.value, receivables: ledger.value.receivables.filter(x => x.id !== record.id) })) {
    if (selectedId.value === record.id) selectedId.value = null
  }
}
function download(type: 'accounts' | 'payments') {
  downloadCsv(type === 'accounts' ? receivablesCsv(ledger.value) : paymentsCsv(ledger.value),
    type === 'accounts' ? 'cobrolisto-cuentas.csv' : 'cobrolisto-abonos.csv')
}
</script>

<template>
  <div class="cl-app">
    <section class="cl-hero" aria-labelledby="cl-title">
      <div class="cl-hero-copy">
        <div class="cl-kicker"><span class="cl-kicker-square">CL</span> MICROAPP / FINANZAS</div>
        <h1 id="cl-title">Cobro<span>Listo.</span></h1>
        <p>Tu trabajo ya está hecho.<br />Ahora controla lo que falta cobrar.</p>
        <div class="cl-hero-actions">
          <button class="cl-hero-button" :disabled="locked" @click="newAccount"><Plus :size="17" /> Nueva cuenta <ArrowRight :size="17" /></button>
          <span class="cl-hero-sub">Sin integraciones bancarias · CLP</span>
        </div>
      </div>
      <div class="cl-hero-right">
        <div class="cl-hero-meta"><span>SALDO TOTAL POR COBRAR</span><span>01 / 06</span></div>
        <div class="cl-hero-money">{{ money(stats.outstanding) }}</div>
        <div class="cl-hero-foot"><span><i></i> {{ stats.active }} {{ stats.active === 1 ? 'cuenta activa' : 'cuentas activas' }}</span><span>Cálculo desde registros locales</span></div>
      </div>
    </section>

    <div class="cl-warning" role="note"><ShieldAlert :size="19" />
      <div><strong>Demostración local, no un sistema de cobranza conectado.</strong> Los datos quedan en este navegador, sin respaldo en la nube. No registra transferencias reales ni envía mensajes. Evita ingresar datos sensibles de clientes.</div>
    </div>
    <div v-if="loadError" class="cl-error" role="alert"><CircleAlert :size="18" /> {{ loadError }} La edición está bloqueada para proteger los registros existentes.</div>
    <div v-if="message" class="cl-error" role="alert"><CircleAlert :size="18" /> {{ message }} <button @click="message = ''" aria-label="Cerrar aviso"><X :size="15" /></button></div>

    <section class="cl-pulse" aria-label="Resumen financiero">
      <div class="cl-pulse-item"><span class="cl-pulse-label"><Wallet :size="17" /> Pendiente total</span><strong>{{ money(stats.outstanding) }}</strong><small>Saldo no cobrado de cuentas no anuladas</small></div>
      <div class="cl-pulse-item"><span class="cl-pulse-label"><CircleAlert :size="17" /> Vencido</span><strong class="cl-pulse-alert">{{ money(stats.overdue) }}</strong><small>Saldo con fecha de pago atrasada</small></div>
      <div class="cl-pulse-item"><span class="cl-pulse-label"><HandCoins :size="17" /> Abonos registrados</span><strong>{{ money(stats.collected) }}</strong><small>Acumulado histórico, no ingreso bancario</small></div>
    </section>

    <section class="cl-aging" aria-label="Antigüedad de cuentas por cobrar">
      <div class="cl-aging-heading"><div><span class="cl-overline">LECTURA DE CARTERA</span><h2>Antigüedad del saldo</h2></div><span class="cl-aging-caption">Clasificación por días desde el vencimiento</span></div>
      <div class="cl-aging-track" role="img" :aria-label="'Saldo vencido: ' + money(aged) + '. Saldo total: ' + money(totalAging)">
        <span v-for="bucket in [
          { value: buckets.current, color: '#b9d7a1' },
          { value: buckets.d1to30, color: '#e8c68b' },
          { value: buckets.d31to60, color: '#dfaa79' },
          { value: buckets.d61to90, color: '#d9826a' },
          { value: buckets.over90, color: '#a84f43' }
        ]" :key="bucket.color" :style="{ width: (totalAging ? 100 * bucket.value / totalAging : 0) + '%', background: bucket.color }"></span>
      </div>
      <div class="cl-aging-legend">
        <div v-for="bucket in [
          { label: 'Al día', value: buckets.current, color: '#b9d7a1' },
          { label: '1–30 días', value: buckets.d1to30, color: '#e8c68b' },
          { label: '31–60 días', value: buckets.d31to60, color: '#dfaa79' },
          { label: '61–90 días', value: buckets.d61to90, color: '#d9826a' },
          { label: 'Más de 90', value: buckets.over90, color: '#a84f43' }
        ]" :key="bucket.label" class="cl-aging-bucket">
          <span class="cl-aging-name"><i :style="{ background: bucket.color }"></i>{{ bucket.label }}</span>
          <strong>{{ money(bucket.value) }}</strong>
        </div>
      </div>
    </section>

    <section class="cl-workspace" aria-label="Gestión de cuentas por cobrar y clientes">
      <div class="cl-workspace-head">
        <div><span class="cl-overline">MESA DE TRABAJO</span><h2>Cartera de cobros<span class="cl-count">{{ recordCount }}</span></h2></div>
        <div class="cl-workspace-actions">
          <button class="cl-quiet" :disabled="!recordCount" @click="download('accounts')"><Download :size="16" /> Cuentas CSV</button>
          <button class="cl-quiet" :disabled="!recordCount" @click="download('payments')"><Download :size="16" /> Abonos CSV</button>
        </div>
      </div>
      <div class="cl-tabs" role="tablist" aria-label="Secciones de CobroListo">
        <button type="button" role="tab" :aria-selected="tab === 'accounts'" :class="{ 'cl-tab-selected': tab === 'accounts' }" @click="tab = 'accounts'; editor = null">Cuentas por cobrar <span>{{ ledger.receivables.length }}</span></button>
        <button type="button" role="tab" :aria-selected="tab === 'customers'" :class="{ 'cl-tab-selected': tab === 'customers' }" @click="tab = 'customers'; editor = null; selectedId = null">Clientes <span>{{ ledger.customers.length }}</span></button>
      </div>

      <div v-if="editor" class="cl-editor" :aria-label="editor === 'account' ? 'Formulario de cuenta' : 'Formulario de cliente'">
        <div class="cl-editor-title"><div><span class="cl-overline">DATOS DEL REGISTRO</span><h3>{{ editor === 'account' ? (editingId ? 'Editar cuenta' : 'Nueva cuenta por cobrar') : (editingId ? 'Editar cliente' : 'Nuevo cliente') }}</h3></div><button class="cl-icon-button" aria-label="Cerrar editor" @click="editor = null"><X :size="20" /></button></div>
        <form v-if="editor === 'account'" class="cl-form" @submit.prevent="saveAccount">
          <label>Cliente <span>*</span><select v-model="draft.customerId" required><option disabled value="">Selecciona un cliente</option><option v-for="c in ledger.customers" :key="c.id" :value="c.id">{{ c.name }}</option></select></label>
          <label>Referencia / Nº documento <span>*</span><input v-model="draft.reference" required maxlength="100" placeholder="Ej. FAC-001" /></label>
          <label>Concepto<input v-model="draft.concept" maxlength="180" placeholder="Ej. Servicio de mantención" /></label>
          <label>Monto total (CLP) <span>*</span><input v-model.number="draft.amount" required type="number" min="1" max="999999999999" step="1" inputmode="numeric" /></label>
          <label>Fecha de emisión <span>*</span><input v-model="draft.issuedOn" required type="date" /></label>
          <label>Fecha de vencimiento <span>*</span><input v-model="draft.dueOn" required type="date" /></label>
          <div v-if="formError" class="cl-form-error" role="alert">{{ formError }}</div>
          <div class="cl-form-actions"><button type="button" class="cl-quiet" @click="editor = null">Cancelar</button><button type="submit" class="cl-solid"><Check :size="16" /> Guardar cuenta</button></div>
        </form>
        <form v-else class="cl-form" @submit.prevent="saveCustomer">
          <label>Nombre o razón social <span>*</span><input v-model="client.name" required minlength="2" maxlength="120" placeholder="Ej. Cliente de demostración" /></label>
          <label>Correo (opcional)<input v-model="client.email" type="email" maxlength="180" placeholder="correo@ejemplo.cl" /></label>
          <label>Teléfono (opcional)<input v-model="client.phone" type="tel" maxlength="30" placeholder="+56 9..." /></label>
          <div v-if="formError" class="cl-form-error" role="alert">{{ formError }}</div>
          <div class="cl-form-actions"><button type="button" class="cl-quiet" @click="editor = null">Cancelar</button><button type="submit" class="cl-solid"><Check :size="16" /> Guardar cliente</button></div>
        </form>
      </div>

      <div v-if="tab === 'accounts'">
        <div class="cl-toolbar">
          <label class="cl-search"><Search :size="18" /><input v-model="search" aria-label="Buscar por cliente, referencia o concepto" placeholder="Buscar cliente o documento..." /></label>
          <label class="cl-select-wrap"><span>Estado</span><select v-model="filter" aria-label="Filtrar cuentas">
            <option value="todas">Todas las cuentas</option><option value="abiertas">Abiertas</option><option value="vencidas">Con saldo vencido</option>
            <option value="pendiente">Pendientes</option><option value="por-vencer">Por vencer</option>
            <option value="parcial">Con abono parcial</option><option value="en-disputa">En disputa</option>
            <option value="pagada">Pagadas</option><option value="anulada">Anuladas</option>
          </select><ChevronDown :size="14" /></label>
          <button class="cl-solid cl-toolbar-add" :disabled="locked" @click="newAccount"><Plus :size="17" /> Nueva cuenta</button>
        </div>
        <div v-if="visible.length" class="cl-table-scroll">
          <table class="cl-table">
            <thead><tr><th>CLIENTE / DOCUMENTO</th><th>VENCIMIENTO</th><th>TOTAL</th><th>ABONADO</th><th>POR COBRAR</th><th>ESTADO</th><th><span class="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              <tr v-for="r in visible" :key="r.id" :class="{ 'cl-row-selected': selectedId === r.id }">
                <td><button class="cl-account-link" @click="selectAccount(r)"><strong>{{ customerById(r.customerId)?.name || 'Cliente desconocido' }}</strong><span>{{ r.reference }}<template v-if="r.concept"> · {{ r.concept }}</template></span></button></td>
                <td class="cl-nowrap">{{ r.dueOn.split('-').reverse().join('/') }}</td>
                <td class="cl-nowrap">{{ money(r.amount) }}</td>
                <td class="cl-nowrap">{{ money(paymentTotal(r)) }}</td>
                <td class="cl-nowrap cl-emphasis">{{ money(r.cancelled ? 0 : balance(r)) }}</td>
                <td><span class="cl-status" :class="'cl-status-' + status(r)"><i></i>{{ statuses[status(r)] }}</span></td>
                <td><button :aria-label="'Ver detalle de ' + r.reference" class="cl-row-arrow" @click="selectAccount(r)"><ArrowRight :size="19" /></button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="cl-empty">
          <div class="cl-empty-icon"><ReceiptText :size="34" :stroke-width="1.6" /></div>
          <h3>{{ ledger.receivables.length ? 'No hay cuentas con esos filtros.' : 'Cobrar empieza por registrar.' }}</h3>
          <p>{{ ledger.receivables.length ? 'Prueba otro término o consulta todas las cuentas.' : 'Añade un cliente y registra su primer cobro. Los saldos se actualizarán con cada abono.' }}</p>
          <button v-if="!ledger.receivables.length" class="cl-solid" :disabled="locked" @click="newAccount"><Plus :size="17" /> Empezar</button>
          <button v-else class="cl-quiet" @click="search = ''; filter = 'todas'">Restablecer filtros</button>
        </div>
      </div>

      <div v-else class="cl-customers">
        <div class="cl-customers-top"><span>{{ ledger.customers.length }} {{ ledger.customers.length === 1 ? 'cliente registrado' : 'clientes registrados' }}</span><button class="cl-solid" :disabled="locked" @click="newCustomer"><Plus :size="16" /> Nuevo cliente</button></div>
        <div v-if="ledger.customers.length" class="cl-customer-grid">
          <article v-for="c in ledger.customers" :key="c.id" class="cl-client">
            <span class="cl-client-avatar"><UserRound :size="22" /></span><div class="cl-client-body"><h3>{{ c.name }}</h3><p>{{ c.email || 'Sin correo' }}</p><small>{{ ledger.receivables.filter(r => r.customerId === c.id).length }} cuentas asociadas</small></div>
            <div class="cl-client-buttons"><button :aria-label="'Editar a ' + c.name" @click="editCustomer(c)"><Pencil :size="17" /></button><button :aria-label="'Eliminar a ' + c.name" :disabled="locked" @click="deleteCustomer(c)"><Trash2 :size="17" /></button></div>
          </article>
        </div>
        <div v-else class="cl-empty"><div class="cl-empty-icon"><UsersRound :size="33" /></div><h3>Tu primer cliente</h3><p>Los clientes se administran aquí y se seleccionan al registrar cada cuenta por cobrar.</p><button class="cl-solid" :disabled="locked" @click="newCustomer"><Plus :size="17" /> Crear cliente</button></div>
      </div>
    </section>

    <section v-if="tab === 'accounts' && chosen" class="cl-detail" aria-label="Detalle de cuenta seleccionada">
      <div class="cl-detail-head">
        <div><span class="cl-overline">DETALLE / {{ chosen.reference }}</span><h2>{{ customerById(chosen.customerId)?.name }}</h2><p>{{ chosen.concept || 'Sin concepto registrado' }}</p></div>
        <button class="cl-icon-button" aria-label="Cerrar detalle" @click="selectedId = null"><X :size="21" /></button>
      </div>
      <div class="cl-detail-figures">
        <div><span>Total documento</span><strong>{{ money(chosen.amount) }}</strong></div>
        <div><span>Abonado</span><strong>{{ money(paymentTotal(chosen)) }}</strong></div>
        <div><span>Saldo pendiente</span><strong>{{ money(chosen.cancelled ? 0 : balance(chosen)) }}</strong></div>
      </div>
      <div class="cl-detail-actions">
        <button class="cl-solid" :disabled="locked || chosen.cancelled || balance(chosen) === 0" @click="startPayment"><ArrowDownLeft :size="17" /> Registrar abono</button>
        <button class="cl-quiet" :disabled="locked" @click="editAccount(chosen)"><Pencil :size="16" /> Editar</button>
        <button class="cl-quiet" :disabled="locked || chosen.cancelled || balance(chosen) === 0" @click="changeDispute(chosen)">{{ chosen.disputed ? 'Quitar disputa' : 'Marcar disputa' }}</button>
        <button class="cl-quiet" :disabled="locked || chosen.payments.length > 0" @click="cancelAccount(chosen)">{{ chosen.cancelled ? 'Reactivar' : 'Anular' }}</button>
        <button class="cl-quiet cl-destructive" :disabled="locked || chosen.payments.length > 0" @click="deleteAccount(chosen)"><Trash2 :size="16" /> Eliminar</button>
      </div>
      <form v-if="paymentOpen" class="cl-payment-form" @submit.prevent="savePayment">
        <div class="cl-payment-form-top"><div><span class="cl-overline">MOVIMIENTO MANUAL</span><h3>Registrar abono</h3></div><button type="button" class="cl-icon-button" aria-label="Cerrar formulario de pago" @click="paymentOpen = false"><X :size="18" /></button></div>
        <div class="cl-payment-fields"><label>Monto en pesos <input v-model.number="payment.amount" required type="number" min="1" step="1" :max="balance(chosen)" /></label><label>Fecha del abono<input v-model="payment.date" required type="date" /></label><label>Nota opcional<input v-model="payment.note" maxlength="240" placeholder="Ej. Transferencia verificada manualmente" /></label></div>
        <div v-if="paymentError" class="cl-form-error" role="alert">{{ paymentError }}</div>
        <button type="submit" class="cl-solid"><Check :size="16" /> Guardar abono manual</button>
        <p>Este registro no verifica transacciones bancarias. Ingresa solamente pagos comprobados por tu cuenta.</p>
      </form>
      <div class="cl-history-title"><span class="cl-overline">HISTORIAL DE ABONOS</span><span>{{ chosen.payments.length }} movimientos</span></div>
      <div v-if="chosen.payments.length" class="cl-history">
        <div v-for="p in [...chosen.payments].reverse()" :key="p.id" class="cl-history-row">
          <div class="cl-history-mark"><Banknote :size="19" /></div>
          <div class="cl-history-description"><strong>{{ money(p.amount) }}</strong><span>{{ p.date.split('-').reverse().join('/') }} · {{ p.note || 'Sin observaciones' }}</span></div>
          <button class="cl-icon-button" :disabled="locked" :aria-label="'Eliminar abono de ' + money(p.amount)" @click="removePayment(chosen, p.id)"><Trash2 :size="16" /></button>
        </div>
      </div>
      <div v-else class="cl-history-empty"><Landmark :size="19" /> Sin pagos registrados para esta cuenta.</div>
    </section>
    <div class="cl-footnote"><FilePlus2 :size="16" /> CobroListo es una herramienta de gestión. No emite documentos tributarios ni reemplaza un sistema contable.</div>
  </div>
</template>
