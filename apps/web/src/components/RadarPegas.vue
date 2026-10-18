<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
  nextTick,
} from 'vue'
import {
  Radar,
  Search as SearchIcon,
  ArrowUpRight,
  ArrowRight,
  Bookmark,
  Bell,
  SlidersHorizontal,
  RefreshCw,
  Download,
  Building2,
  MapPin,
  Clock3,
  X,
  Check,
  Plus,
  Trash2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  ListTodo,
  ShieldCheck,
  CircleHelp,
  KeyRound,
  Copy,
  CalendarDays,
  Activity,
} from 'lucide-vue-next'
import {
  request,
  setCsrf,
  ApiError,
  stageLabels,
  statusLabels,
  dateLabel,
  money,
  closingLabel,
  defaultFilters,
} from '../radar/api'
import type {
  Tender,
  Stage,
  Task,
  User,
  Overview,
  Profile,
  Search,
  Notification,
} from '../radar/api'
import '../radar/radar.css'

const user = ref<User | null>(null),
  checking = ref(true),
  busy = ref(false),
  loading = ref(false),
  error = ref(''),
  message = ref('')
const email = ref(''),
  password = ref(''),
  tab = ref('discover')
const overview = ref<Overview | null>(null),
  items = ref<Tender[]>([]),
  total = ref(0),
  page = ref(1),
  sort = ref('relevance')
const filters = reactive(defaultFilters()),
  recommended = ref(false),
  stage = ref(''),
  filtersOpen = ref(false)
const searches = ref<Search[]>([]),
  notifications = ref<Notification[]>([])
const detail = ref<Tender | null>(null),
  dialog = ref<HTMLDialogElement | null>(null)
const draftStage = ref<Stage>('saved'),
  owner = ref(''),
  tasks = ref<Task[]>([]),
  note = ref(''),
  taskTitle = ref(''),
  taskDue = ref('')
const profile = reactive<Profile>({
    name: '',
    keywords: [],
    excludes: [],
    regions: [],
    version: 0,
  }),
  keywords = ref(''),
  excludes = ref(''),
  profileRegions = ref('')
const searchDialog = ref<HTMLDialogElement | null>(null),
  searchName = ref('')
const importDialog = ref<HTMLDialogElement | null>(null),
  importCode = ref('')
const securityDialog = ref<HTMLDialogElement | null>(null),
  currentPassword = ref(''),
  newPassword = ref('')
const auditRows = ref<
  { action: string; resource: string; createdAt: string; actor: string }[]
>([])
const actionLabels: Record<string, string> = {
  saved: 'Guardó oportunidad',
  tracking_updated: 'Actualizó seguimiento',
  note_added: 'Añadió nota',
  tracking_removed: 'Quitó seguimiento',
  profile_updated: 'Actualizó perfil',
  search_created: 'Creó búsqueda',
  sync_requested: 'Solicitó actualización',
  login: 'Inició sesión',
  password_changed: 'Cambió contraseña',
}
const tabs = [
  { id: 'discover', name: 'Descubrir', icon: Radar },
  { id: 'tracking', name: 'Mi seguimiento', icon: Bookmark },
  { id: 'alerts', name: 'Búsquedas y alertas', icon: Bell },
  { id: 'profile', name: 'Perfil comercial', icon: SlidersHorizontal },
]
const stageEntries = Object.entries(stageLabels) as [Stage, string][]
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / 24)))
const unread = computed(() => overview.value?.unread || 0)
const tasksDone = computed(() => tasks.value.filter((t) => t.done).length)
let sequence = 0,
  debounce: ReturnType<typeof setTimeout> | undefined,
  poller: ReturnType<typeof setInterval> | undefined,
  toastTimer: ReturnType<typeof setTimeout> | undefined
function toast(text: string) {
  message.value = text
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (message.value = ''), 5000)
}
function showError(e: unknown) {
  error.value =
    e instanceof Error ? e.message : 'No se pudo completar la operación.'
  if (e instanceof ApiError && e.status === 401) {
    user.value = null
    setCsrf('')
    dialog.value?.close()
    searchDialog.value?.close()
    securityDialog.value?.close()
  }
}
async function action(fn: () => Promise<void>) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await fn()
  } catch (e) {
    showError(e)
  } finally {
    busy.value = false
  }
}
async function loadOverview() {
  overview.value = await request<Overview>('/radar/overview')
}
async function loadList() {
  const id = ++sequence
  loading.value = true
  const query = new URLSearchParams({
    ...Object.fromEntries(
      Object.entries(filters).map(([k, v]) => [k, String(v)]),
    ),
    page: String(page.value),
    sort: sort.value,
  })
  if (tab.value === 'tracking') query.set('saved', 'true')
  if (recommended.value) query.set('recommended', 'true')
  if (stage.value && tab.value === 'tracking') query.set('stage', stage.value)
  try {
    const result = await request<{ items: Tender[]; total: number }>(
      `/radar/tenders?${query}`,
    )
    if (id === sequence) {
      items.value = result.items
      total.value = result.total
    }
  } catch (e) {
    if (id === sequence) showError(e)
  } finally {
    if (id === sequence) loading.value = false
  }
}
async function loadAlerts() {
  ;[searches.value, notifications.value] = await Promise.all([
    request<Search[]>('/radar/searches'),
    request<Notification[]>('/radar/notifications'),
  ])
}
function fillProfile() {
  if (!overview.value) return
  Object.assign(profile, overview.value.profile)
  keywords.value = profile.keywords.join(', ')
  excludes.value = profile.excludes.join(', ')
  profileRegions.value = profile.regions.join(', ')
}
async function init() {
  await loadOverview()
  fillProfile()
  await Promise.all([loadList(), loadAlerts()])
}
async function login() {
  await action(async () => {
    await request('/auth/login', 'POST', {
      email: email.value,
      password: password.value,
    })
    password.value = ''
    user.value = await request<User>('/auth/me')
    setCsrf(user.value.csrf)
    await init()
  })
}
async function logout() {
  await action(async () => {
    await request('/auth/logout', 'POST', {})
    user.value = null
    setCsrf('')
    items.value = []
    detail.value = null
  })
}
watch(
  [
    () => filters.q,
    () => filters.region,
    () => filters.buyer,
    () => filters.status,
    () => filters.closingDays,
    sort,
    recommended,
    stage,
  ],
  () => {
    if (!user.value) return
    page.value = 1
    clearTimeout(debounce)
    debounce = setTimeout(() => void loadList(), 250)
  },
)
watch(page, () => {
  if (user.value) void loadList()
})
async function changeTab(value: string) {
  tab.value = value
  page.value = 1
  error.value = ''
  if (value === 'tracking') {
    filters.status = 'all'
    recommended.value = false
  } else if (value === 'discover') {
    filters.status = 'open'
  }
  if (['tracking', 'discover'].includes(value)) await loadList()
  if (value === 'alerts') await action(loadAlerts)
  if (value === 'profile')
    await action(async () => {
      await loadOverview()
      fillProfile()
      auditRows.value = await request('/radar/audit')
    })
}
function showImport() {
  importCode.value = ''
  importDialog.value?.showModal()
}
function showSearch() {
  searchName.value = ''
  searchDialog.value?.showModal()
}
function selectPreset(kind: string) {
  resetFilters()
  tab.value = 'discover'
  filters.status = 'open'
  recommended.value = kind === 'recommended'
  filters.closingDays = kind === 'closing' ? 2 : 0
  page.value = 1
  void loadList()
}
function resetFilters() {
  Object.assign(filters, defaultFilters())
  if (tab.value === 'tracking') filters.status = 'all'
  recommended.value = false
  stage.value = ''
  sort.value = 'relevance'
}
async function openTender(t: Tender | string) {
  await action(async () => {
    detail.value = await request<Tender>(
      `/radar/tenders/${encodeURIComponent(typeof t === 'string' ? t : t.id)}`,
    )
    fillDraft()
    note.value = ''
    taskTitle.value = ''
    taskDue.value = ''
    await nextTick()
    dialog.value?.showModal()
  })
}
function fillDraft() {
  if (!detail.value) return
  draftStage.value = detail.value.saved?.stage || 'saved'
  owner.value = detail.value.saved?.owner || ''
  tasks.value = (detail.value.saved?.tasks || []).map((t) => ({ ...t }))
}
async function updateTender(t: Tender, reset = true) {
  detail.value = t
  if (reset) fillDraft()
  items.value = items.value.map((i) => (i.id === t.id ? t : i))
  await loadOverview()
}
async function saveTender(t: Tender) {
  await action(async () => {
    const result = await request<Tender>(
      `/radar/tenders/${t.id}/save`,
      'POST',
      {},
    )
    if (detail.value?.id === t.id) await updateTender(result)
    else {
      items.value = items.value.map((i) => (i.id === t.id ? result : i))
      await loadOverview()
    }
    toast('Oportunidad guardada en tu seguimiento.')
  })
}
async function saveTracking() {
  if (!detail.value?.saved) return
  await action(async () => {
    const t = detail.value!
    await updateTender(
      await request<Tender>(`/radar/tenders/${t.id}/save`, 'PATCH', {
        version: t.saved!.version,
        stage: draftStage.value,
        owner: owner.value,
        tasks: tasks.value,
      }),
    )
    toast('Seguimiento actualizado.')
  })
}
async function addNote() {
  if (!detail.value || !note.value.trim()) return
  await action(async () => {
    await updateTender(
      await request<Tender>(
        `/radar/tenders/${detail.value!.id}/notes`,
        'POST',
        { text: note.value },
      ),
      false,
    )
    note.value = ''
    toast('Nota registrada.')
  })
}
async function removeTracking() {
  if (
    !detail.value ||
    !window.confirm(
      '¿Quitar el seguimiento? Se eliminarán sus notas y tareas en tu organización.',
    )
  )
    return
  await action(async () => {
    await request(`/radar/tenders/${detail.value!.id}/save`, 'DELETE', {})
    detail.value = { ...detail.value!, saved: null }
    fillDraft()
    await Promise.all([loadOverview(), loadList()])
    toast('Seguimiento eliminado.')
  })
}
function addTask() {
  if (!taskTitle.value.trim() || tasks.value.length >= 100) return
  tasks.value.push({
    id: crypto.randomUUID(),
    title: taskTitle.value.trim(),
    done: false,
    due: taskDue.value || null,
  })
  taskTitle.value = ''
  taskDue.value = ''
}
function standardTasks() {
  for (const title of [
    'Leer bases y anexos oficiales',
    'Revisar requisitos de participación',
    'Preparar propuesta técnica',
    'Revisar propuesta económica',
    'Comprobar entrega en Mercado Público',
  ])
    if (!tasks.value.some((t) => t.title === title))
      tasks.value.push({
        id: crypto.randomUUID(),
        title,
        done: false,
        due: null,
      })
}
async function refreshDetail() {
  if (!detail.value) return
  await action(async () => {
    await updateTender(
      await request<Tender>(
        `/radar/tenders/${detail.value!.id}/refresh`,
        'POST',
        {},
      ),
    )
    toast('Detalle revisado.')
    await loadList()
  })
}
async function reloadDetail() {
  if (!detail.value) return
  await action(async () => {
    await updateTender(
      await request<Tender>(`/radar/tenders/${detail.value!.id}`),
    )
    error.value = ''
    toast('Versión actual cargada.')
  })
}
async function sync() {
  await action(async () => {
    await request('/radar/sync', 'POST', {})
    await loadOverview()
    toast(
      overview.value?.mode === 'demo'
        ? 'Se revisaron los ejemplos.'
        : 'Sincronización solicitada. Puedes seguir trabajando.',
    )
  })
}
async function importTender() {
  await action(async () => {
    const t = await request<Tender>('/radar/import', 'POST', {
      code: importCode.value.trim(),
    })
    importDialog.value?.close()
    detail.value = t
    fillDraft()
    note.value = ''
    await loadOverview()
    await loadList()
    await nextTick()
    dialog.value?.showModal()
    toast('Oportunidad importada desde la fuente.')
  })
}
async function saveSearch() {
  await action(async () => {
    await request('/radar/searches', 'POST', {
      name: searchName.value,
      filters: { ...filters },
    })
    searchDialog.value?.close()
    searchName.value = ''
    await Promise.all([loadAlerts(), loadOverview()])
    toast('Búsqueda guardada. Recibirás coincidencias en la bandeja interna.')
  })
}
async function toggleSearch(s: Search) {
  await action(async () => {
    await request(`/radar/searches/${s.id}`, 'PATCH', { enabled: !s.enabled })
    await loadAlerts()
  })
}
async function deleteSearch(s: Search) {
  if (!window.confirm(`¿Eliminar la búsqueda «${s.name}»?`)) return
  await action(async () => {
    await request(`/radar/searches/${s.id}`, 'DELETE', {})
    await loadAlerts()
  })
}
function applySearch(s: Search) {
  Object.assign(filters, s.filters)
  tab.value = 'discover'
  recommended.value = false
  stage.value = ''
  page.value = 1
  void loadList()
}
async function markRead(id?: string) {
  await action(async () => {
    await request('/radar/notifications/read', 'POST', id ? { id } : {})
    await Promise.all([loadAlerts(), loadOverview()])
  })
}
const split = (s: string) => [
  ...new Set(
    s
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  ),
]
async function saveProfile() {
  await action(async () => {
    Object.assign(
      profile,
      await request<Profile>('/radar/profile', 'PUT', {
        name: profile.name,
        keywords: split(keywords.value),
        excludes: split(excludes.value),
        regions: split(profileRegions.value),
        version: profile.version,
      }),
    )
    await Promise.all([loadOverview(), loadList()])
    toast('Perfil comercial actualizado.')
  })
}
async function exportCsv() {
  await action(async () => {
    const q = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters).map(([k, v]) => [k, String(v)]),
      ),
    )
    q.set('sort', sort.value)
    if (tab.value === 'tracking') q.set('saved', 'true')
    if (recommended.value) q.set('recommended', 'true')
    if (stage.value && tab.value === 'tracking') q.set('stage', stage.value)
    const response = await fetch(`/api/radar/export.csv?${q}`, {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok)
      throw new ApiError(
        response.status,
        'No se pudo exportar. Vuelve a iniciar sesión si es necesario.',
      )
    download(await response.blob(), 'radar-de-pegas.csv')
    toast('Exportación descargada.')
  })
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function calendar() {
  const t = detail.value
  if (!t?.closesAt) return
  const escape = (s: string) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;')
  const stamp = (d: string) =>
    new Date(d)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')
  download(
    new Blob(
      [
        [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//ExpressApps//Radar de Pegas//ES',
          'BEGIN:VEVENT',
          `UID:${t.source}-${t.id}@radardepegas`,
          `DTSTAMP:${stamp(new Date().toISOString())}`,
          `DTSTART:${stamp(t.closesAt)}`,
          `SUMMARY:${escape('Cierre: ' + t.title)}`,
          `DESCRIPTION:${escape('Verifica el plazo en las bases oficiales. Código: ' + t.id)}`,
          'END:VEVENT',
          'END:VCALENDAR',
        ].join('\r\n') + '\r\n',
      ],
      { type: 'text/calendar;charset=utf-8' },
    ),
    'cierre-licitacion.ics',
  )
}
async function copyCode() {
  if (!detail.value) return
  try {
    await navigator.clipboard.writeText(detail.value.id)
    toast('Código copiado.')
  } catch {
    toast('Selecciona el código para copiarlo.')
  }
}
async function changePassword() {
  await action(async () => {
    await request('/auth/password', 'POST', {
      current: currentPassword.value,
      password: newPassword.value,
    })
    currentPassword.value = ''
    newPassword.value = ''
    securityDialog.value?.close()
    user.value = null
    setCsrf('')
    toast('Contraseña cambiada. Inicia sesión nuevamente.')
  })
}
onMounted(async () => {
  try {
    user.value = await request<User>('/auth/me')
    setCsrf(user.value.csrf)
    await init()
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) showError(e)
  } finally {
    checking.value = false
  }
  poller = setInterval(async () => {
    if (!user.value) return
    try {
      const previous = overview.value?.sync?.status
      await loadOverview()
      if (previous === 'running' && overview.value?.sync?.status !== 'running')
        await Promise.all([loadList(), loadAlerts()])
    } catch (e) {
      showError(e)
    }
  }, 15000)
})
onUnmounted(() => {
  clearTimeout(debounce)
  clearTimeout(toastTimer)
  clearInterval(poller)
  sequence++
})
</script>

<template>
  <div class="radar-app">
    <div v-if="checking" class="rp-loading">
      <Radar :size="32" class="rp-spin" />
      <p>Preparando tu radar…</p>
    </div>
    <template v-else>
      <div v-if="!user" class="rp-login">
        <section class="rp-login-story">
          <div class="rp-wordmark">
            <Radar :size="28" /> radar<span>de pegas</span>
          </div>
          <span class="rp-eyebrow">OPORTUNIDADES CON DIRECCIÓN</span>
          <h1>Tu próxima pega<br />puede estar<br /><em>aquí.</em></h1>
          <p>
            Encuentra licitaciones que calzan con tu negocio. Evalúa, organiza y
            prepara tu próxima oferta en un solo lugar.
          </p>
          <div class="rp-login-steps">
            <span><SearchIcon :size="18" /> Encuentra</span
            ><span><Bookmark :size="18" /> Evalúa</span
            ><span><CheckCircle2 :size="18" /> Prepara</span>
          </div>
          <small>Un producto de ExpressApps · Chile</small>
        </section>
        <form class="rp-login-form" @submit.prevent="login">
          <div class="rp-small-icon"><ShieldCheck :size="23" /></div>
          <span class="rp-eyebrow">TU ESPACIO DE TRABAJO</span>
          <h2>Vamos por esa oportunidad.</h2>
          <p>Accede con la cuenta de tu organización.</p>
          <label
            >Correo electrónico<input
              v-model="email"
              required
              type="email"
              autocomplete="username"
              maxlength="254"
              placeholder="tu@empresa.cl" /></label
          ><label
            >Contraseña<input
              v-model="password"
              required
              type="password"
              autocomplete="current-password"
              maxlength="256"
          /></label>
          <p v-if="error" class="rp-error" role="alert">{{ error }}</p>
          <button class="rp-primary" :disabled="busy">
            {{ busy ? 'Ingresando…' : 'Ingresar a mi radar'
            }}<ArrowRight :size="17" />
          </button>
          <div class="rp-login-help">
            <KeyRound :size="17" /><span
              >El administrador habilita las cuentas y recupera el acceso. No
              hay registro público.</span
            >
          </div>
        </form>
      </div>
      <template v-else>
        <header class="rp-heading">
          <div>
            <div class="rp-wordmark">
              <Radar :size="26" /> radar<span>de pegas</span
              ><span class="rp-beta">EXPRESSAPPS</span>
            </div>
            <p>Encuentra oportunidades. Decide dónde poner tu energía.</p>
          </div>
          <div class="rp-account">
            <span class="rp-avatar">{{
              user.name.slice(0, 2).toUpperCase()
            }}</span
            ><span
              >{{ user.organization }}<small>{{ user.name }}</small></span
            ><button
              class="rp-icon-button"
              title="Cambiar contraseña"
              aria-label="Cambiar contraseña"
              @click="securityDialog?.showModal()"
            >
              <KeyRound :size="17" /></button
            ><button
              class="rp-icon-button"
              :disabled="busy"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              @click="logout"
            >
              <LogOut :size="17" />
            </button>
          </div>
        </header>
        <div
          class="rp-source"
          :class="{ 'rp-demo': overview?.mode === 'demo' }"
        >
          <span class="rp-source-dot"></span
          ><span v-if="overview?.mode === 'demo'"
            ><strong>Demostración</strong> · Todos los organismos, montos y
            oportunidades son ejemplos ficticios.</span
          ><span v-else-if="!overview?.configured"
            ><strong>Fuente pendiente de conexión.</strong> Configura el ticket
            de ChileCompra en el servidor para importar oportunidades.</span
          ><span v-else
            ><strong>Mercado Público</strong> ·
            {{
              overview?.sync?.finished_at
                ? 'Última revisión: ' +
                  dateLabel(overview.sync.finished_at, true)
                : 'Sin primera sincronización'
            }}</span
          ><button
            v-if="user.role === 'admin'"
            class="rp-inline"
            :disabled="busy || overview?.sync?.status === 'running'"
            @click="sync"
          >
            <RefreshCw
              :size="13"
              :class="{ 'rp-spin': overview?.sync?.status === 'running' }"
            />{{
              overview?.sync?.status === 'running'
                ? 'Sincronizando…'
                : 'Actualizar fuente'
            }}
          </button>
        </div>
        <nav class="rp-tabs" aria-label="Secciones de Radar de Pegas">
          <button
            v-for="t in tabs"
            :key="t.id"
            :class="{ active: tab === t.id }"
            :aria-current="tab === t.id ? 'page' : undefined"
            @click="changeTab(t.id)"
          >
            <component :is="t.icon" :size="17" />{{ t.name
            }}<span v-if="t.id === 'alerts' && unread" class="rp-count">{{
              unread
            }}</span>
          </button>
        </nav>
        <div v-if="error" class="rp-error rp-global-error" role="alert">
          {{ error
          }}<button class="rp-inline" @click="error = ''">Cerrar</button>
        </div>
        <template v-if="tab === 'discover' || tab === 'tracking'">
          <section class="rp-intro">
            <div>
              <span class="rp-eyebrow">{{
                tab === 'tracking'
                  ? 'DE OPORTUNIDAD A PROPUESTA'
                  : 'TU RADAR COMERCIAL'
              }}</span>
              <h1>
                {{
                  tab === 'tracking'
                    ? 'Las pegas que vas a perseguir.'
                    : 'Menos ruido. Mejores oportunidades.'
                }}
              </h1>
              <p>
                {{
                  tab === 'tracking'
                    ? 'Organiza decisiones, responsables y próximos pasos.'
                    : 'Explora licitaciones y prioriza las que coinciden con lo que ofreces.'
                }}
              </p>
            </div>
            <div class="rp-intro-actions">
              <button
                v-if="overview?.mode === 'live'"
                class="rp-secondary"
                :disabled="busy || !overview?.configured"
                @click="showImport"
              >
                <Plus :size="16" /> Consultar código</button
              ><button
                class="rp-secondary"
                :disabled="busy || !total"
                @click="exportCsv"
              >
                <Download :size="16" /> Exportar CSV
              </button>
            </div>
          </section>
          <section class="rp-stats" aria-label="Resumen de oportunidades">
            <button @click="selectPreset('all')">
              <span>Publicadas en el radar<Radar :size="17" /></span
              ><strong>{{ overview?.stats.open ?? 0 }}</strong
              ><small>Del conjunto importado</small></button
            ><button @click="selectPreset('recommended')">
              <span>Coinciden con tu perfil<CheckCircle2 :size="17" /></span
              ><strong>{{ overview?.stats.recommended ?? 0 }}</strong
              ><small>Por palabras clave</small></button
            ><button @click="changeTab('tracking')">
              <span>En seguimiento<Bookmark :size="17" /></span
              ><strong>{{ overview?.stats.saved ?? 0 }}</strong
              ><small>Decisiones de tu equipo</small></button
            ><button class="rp-urgent-stat" @click="selectPreset('closing')">
              <span>Cierran en 48 horas<Clock3 :size="17" /></span
              ><strong>{{ overview?.stats.closing ?? 0 }}</strong
              ><small>Revisa los plazos oficiales</small>
            </button>
          </section>
          <section class="rp-search-panel">
            <div class="rp-search-main">
              <label class="rp-search-field"
                ><SearchIcon :size="19" /><input
                  v-model="filters.q"
                  aria-label="Buscar oportunidades"
                  placeholder="Busca un servicio, palabra clave o código…"
                  maxlength="200" /><button
                  v-if="filters.q"
                  class="rp-icon-button"
                  aria-label="Limpiar búsqueda"
                  @click="filters.q = ''"
                >
                  <X :size="15" /></button></label
              ><button
                class="rp-secondary"
                :aria-expanded="filtersOpen"
                @click="filtersOpen = !filtersOpen"
              >
                <SlidersHorizontal :size="16" /> Filtros</button
              ><button class="rp-primary" @click="showSearch">
                <Bell :size="16" /> Crear alerta
              </button>
            </div>
            <div v-if="filtersOpen" class="rp-filters">
              <label
                >Región del comprador<select v-model="filters.region">
                  <option value="">Todas las regiones</option>
                  <option v-for="r in overview?.regions" :key="r">
                    {{ r }}
                  </option>
                </select></label
              ><label
                >Organismo<input
                  v-model="filters.buyer"
                  placeholder="Nombre del comprador"
                  maxlength="160" /></label
              ><label
                >Estado en la fuente<select v-model="filters.status">
                  <option value="all">Todos los estados</option>
                  <option value="open">Publicadas</option>
                  <option value="closed">Cerradas</option>
                  <option value="awarded">Adjudicadas</option>
                  <option value="deserted">Desiertas</option>
                </select></label
              ><label
                >Próximo cierre<select v-model.number="filters.closingDays">
                  <option :value="0">Cualquier fecha</option>
                  <option :value="2">En 48 horas</option>
                  <option :value="7">En 7 días</option>
                  <option :value="30">En 30 días</option>
                </select></label
              >
            </div>
            <div class="rp-search-bottom">
              <label class="rp-checkbox"
                ><input v-model="recommended" type="checkbox" /> Solo
                coincidencias con mi perfil</label
              ><button class="rp-inline" @click="resetFilters">
                Limpiar filtros</button
              ><span class="rp-muted">{{
                tab === 'tracking'
                  ? 'Tus seguimientos conservan todas las oportunidades guardadas.'
                  : 'Las exclusiones de tu perfil se aplican a la búsqueda.'
              }}</span>
            </div>
          </section>
          <div class="rp-results-head">
            <h2>
              {{ tab === 'tracking' ? 'Mi seguimiento' : 'Oportunidades' }}
              <span>{{ total }}</span>
            </h2>
            <div>
              <label v-if="tab === 'tracking'"
                >Etapa<select v-model="stage">
                  <option value="">Todas</option>
                  <option
                    v-for="[key, label] in stageEntries"
                    :key="key"
                    :value="key"
                  >
                    {{ label }}
                  </option>
                </select></label
              ><label
                >Ordenar<select v-model="sort">
                  <option value="relevance">Coincidencia</option>
                  <option value="closing">Cierre más próximo</option>
                  <option value="recent">Más recientes</option>
                  <option value="amount">Monto publicado</option>
                </select></label
              >
            </div>
          </div>
          <div v-if="loading" class="rp-list-state" role="status">
            <RefreshCw :size="22" class="rp-spin" /> Buscando oportunidades…
          </div>
          <div v-else-if="!items.length" class="rp-empty">
            <Radar :size="44" />
            <h3>
              {{
                tab === 'tracking'
                  ? 'Tu próxima propuesta empieza aquí.'
                  : 'No hay oportunidades para estos filtros.'
              }}
            </h3>
            <p>
              {{
                tab === 'tracking'
                  ? 'Guarda una oportunidad desde Descubrir para agregar tareas, responsables y notas.'
                  : overview?.stats.total
                    ? 'Prueba otras palabras o amplía la región y el estado.'
                    : 'Actualiza la fuente para importar datos. Sin ticket, no se muestran oportunidades ficticias.'
              }}
            </p>
            <button
              class="rp-secondary"
              @click="
                tab === 'tracking' ? changeTab('discover') : resetFilters()
              "
            >
              {{
                tab === 'tracking'
                  ? 'Descubrir oportunidades'
                  : 'Limpiar filtros'
              }}<ArrowRight :size="16" />
            </button>
          </div>
          <div v-else class="rp-opportunities">
            <article v-for="t in items" :key="t.id" class="rp-opportunity">
              <div class="rp-card-top">
                <span class="rp-code">{{ t.id }}</span
                ><span class="rp-badge" :class="'rp-status-' + t.status">{{
                  statusLabels[t.status] || 'Sin informar'
                }}</span
                ><span v-if="t.relevance.matched.length" class="rp-match"
                  ><span></span>{{ t.relevance.matched.length }}
                  {{
                    t.relevance.matched.length === 1
                      ? 'coincidencia'
                      : 'coincidencias'
                  }}</span
                ><button
                  class="rp-bookmark"
                  :class="{ selected: t.saved }"
                  :disabled="busy"
                  :aria-label="
                    t.saved ? 'Abrir seguimiento de ' + t.id : 'Guardar ' + t.id
                  "
                  :title="t.saved ? 'En seguimiento' : 'Guardar oportunidad'"
                  @click="t.saved ? openTender(t) : saveTender(t)"
                >
                  <Bookmark
                    :size="19"
                    :fill="t.saved ? 'currentColor' : 'none'"
                  />
                </button>
              </div>
              <button class="rp-title-button" @click="openTender(t)">
                <h3>{{ t.title }}</h3>
              </button>
              <div class="rp-buyer">
                <Building2 :size="14" />{{
                  t.buyer || 'Organismo pendiente de detalle'
                }}
              </div>
              <p class="rp-description">
                {{
                  t.description ||
                  'El resumen no incluye descripción. Actualiza el detalle o consulta las bases oficiales.'
                }}
              </p>
              <div class="rp-keywords">
                <span
                  v-for="word in t.relevance.matched.slice(0, 3)"
                  :key="word"
                  >{{ word }}</span
                ><span v-if="!t.detailed" class="rp-summary-only"
                  >Resumen · detalle pendiente</span
                ><span v-if="t.saved" class="rp-stage-chip">{{
                  stageLabels[t.saved.stage]
                }}</span>
              </div>
              <div class="rp-card-foot">
                <div>
                  <span
                    ><MapPin :size="13" />{{
                      t.region || 'Región sin informar'
                    }}</span
                  ><strong>{{ money(t) }}</strong>
                </div>
                <div
                  class="rp-deadline"
                  :class="{
                    urgent:
                      t.status === 'open' &&
                      !!t.closesAt &&
                      Date.parse(t.closesAt) - Date.now() < 48 * 3600000,
                  }"
                >
                  <span><Clock3 :size="13" />{{ closingLabel(t) }}</span
                  ><small>{{ dateLabel(t.closesAt, true) }}</small>
                </div>
                <button
                  class="rp-open"
                  :aria-label="'Ver detalle de ' + t.id"
                  @click="openTender(t)"
                >
                  <ArrowUpRight :size="21" />
                </button>
              </div>
            </article>
          </div>
          <div class="rp-pagination">
            <span
              >{{ total ? (page - 1) * 24 + 1 : 0 }}–{{
                Math.min(page * 24, total)
              }}
              de {{ total }}</span
            >
            <div>
              <button
                class="rp-icon-button"
                :disabled="page <= 1 || loading"
                aria-label="Página anterior"
                @click="page--"
              >
                <ChevronLeft :size="17" /></button
              ><span>Página {{ page }} de {{ pageCount }}</span
              ><button
                class="rp-icon-button"
                :disabled="page >= pageCount || loading"
                aria-label="Página siguiente"
                @click="page++"
              >
                <ChevronRight :size="17" />
              </button>
            </div>
          </div>
          <p class="rp-footnote">
            <CircleHelp :size="14" /> Cobertura: últimos
            {{ overview?.coverage.days }} días consultados y seguimientos
            actualizados por lotes. No es un catálogo completo ni garantiza
            elegibilidad. Verifica siempre las bases y plazos en Mercado
            Público.
          </p>
        </template>
        <template v-else-if="tab === 'alerts'">
          <section class="rp-intro">
            <div>
              <span class="rp-eyebrow">QUE LA OPORTUNIDAD NO SE TE PASE</span>
              <h1>Tu radar sigue mirando.</h1>
              <p>
                Coincidencias de búsquedas, próximos cierres y tareas en una
                bandeja interna.
              </p>
            </div>
            <button
              class="rp-secondary"
              :disabled="busy || !unread"
              @click="markRead()"
            >
              <Check :size="16" /> Marcar todas leídas
            </button>
          </section>
          <div class="rp-alert-layout">
            <section class="rp-panel">
              <div class="rp-panel-head">
                <h2>
                  Bandeja de alertas <span>{{ unread }}</span>
                </h2>
                <Bell :size="19" />
              </div>
              <div v-if="!notifications.length" class="rp-empty rp-empty-small">
                <Bell :size="30" />
                <h3>Todo tranquilo por aquí.</h3>
                <p>
                  Guarda una búsqueda desde Descubrir para recibir
                  coincidencias.
                </p>
              </div>
              <article
                v-for="n in notifications"
                :key="n.id"
                class="rp-notification"
                :class="{ unread: !n.readAt }"
              >
                <span class="rp-notification-icon"
                  ><component
                    :is="
                      n.kind === 'deadline'
                        ? Clock3
                        : n.kind === 'task'
                          ? ListTodo
                          : Radar
                    "
                    :size="17"
                /></span>
                <div>
                  <button
                    v-if="n.tenderId"
                    class="rp-notification-title"
                    @click="openTender(n.tenderId)"
                  >
                    {{ n.title }}</button
                  ><strong v-else>{{ n.title }}</strong
                  ><small>{{ dateLabel(n.createdAt, true) }}</small>
                </div>
                <button
                  v-if="!n.readAt"
                  class="rp-icon-button"
                  :disabled="busy"
                  aria-label="Marcar alerta leída"
                  @click="markRead(n.id)"
                >
                  <Check :size="16" />
                </button>
              </article>
            </section>
            <section class="rp-panel">
              <div class="rp-panel-head">
                <h2>Búsquedas guardadas</h2>
                <SearchIcon :size="19" />
              </div>
              <div v-if="!searches.length" class="rp-panel-body">
                <p>
                  Combina palabras, región y cierre en Descubrir y pulsa «Crear
                  alerta».
                </p>
                <button class="rp-secondary" @click="changeTab('discover')">
                  Crear mi primera búsqueda<ArrowRight :size="16" />
                </button>
              </div>
              <article
                v-for="s in searches"
                :key="s.id"
                class="rp-saved-search"
              >
                <div>
                  <h3>{{ s.name }}</h3>
                  <span class="rp-badge">{{
                    s.enabled ? 'Activa' : 'Pausada'
                  }}</span>
                </div>
                <p>
                  {{ s.filters.q || 'Cualquier palabra' }} ·
                  {{ s.filters.region || 'Todas las regiones' }}
                </p>
                <small
                  >{{ statusLabels[s.filters.status] || 'Todos los estados'
                  }}{{
                    s.filters.closingDays
                      ? ' · Cierre en ' + s.filters.closingDays + ' días'
                      : ''
                  }}</small
                >
                <div>
                  <button class="rp-inline" @click="applySearch(s)">
                    Ver resultados<ArrowUpRight :size="14" /></button
                  ><button
                    class="rp-inline"
                    :disabled="busy"
                    @click="toggleSearch(s)"
                  >
                    {{ s.enabled ? 'Pausar' : 'Activar' }}</button
                  ><button
                    class="rp-icon-button"
                    :disabled="busy"
                    aria-label="Eliminar búsqueda"
                    @click="deleteSearch(s)"
                  >
                    <Trash2 :size="15" />
                  </button>
                </div>
              </article>
              <div class="rp-help-note">
                <CircleHelp :size="16" />
                <p>
                  Las alertas se generan al sincronizar y revisar tareas. Las
                  búsquedas usan sus propios filtros; la casilla de
                  coincidencias del perfil no se guarda. No se envían correos ni
                  WhatsApp.
                </p>
              </div>
            </section>
          </div>
        </template>
        <template v-else-if="tab === 'profile'">
          <section class="rp-intro">
            <div>
              <span class="rp-eyebrow">TU ESPECIALIDAD, PRIMERO</span>
              <h1>¿Qué pegas estás buscando?</h1>
              <p>
                Las palabras de tu perfil ayudan a ordenar oportunidades; no son
                una evaluación de requisitos.
              </p>
            </div>
          </section>
          <div class="rp-profile-layout">
            <form
              class="rp-panel rp-profile-form"
              @submit.prevent="saveProfile"
            >
              <h2>Perfil comercial</h2>
              <label
                >Nombre comercial<input
                  v-model="profile.name"
                  required
                  minlength="2"
                  maxlength="120"
                  placeholder="ExpressWebsite" /></label
              ><label
                >Servicios o palabras clave<textarea
                  v-model="keywords"
                  rows="3"
                  maxlength="2400"
                  placeholder="desarrollo web, software, capacitación"
                /><small
                  >Separadas por comas. Hasta 30 términos, de 2 a 80
                  caracteres.</small
                ></label
              ><label
                >Excluir oportunidades que contengan<textarea
                  v-model="excludes"
                  rows="2"
                  maxlength="2400"
                  placeholder="aseo, construcción"
                /></label
              ><label
                >Regiones preferidas<input
                  v-model="profileRegions"
                  maxlength="2000"
                  placeholder="Valparaíso, Metropolitana de Santiago"
                /><small
                  >Usa el nombre de la región que aparece en los resultados.
                  Suma afinidad, no limita la búsqueda.</small
                ></label
              ><button class="rp-primary" :disabled="busy">
                <Check :size="16" /> Guardar perfil
              </button>
            </form>
            <div>
              <section class="rp-panel rp-panel-body">
                <span class="rp-small-icon"><Radar :size="22" /></span>
                <h2>Coincidencias explicables.</h2>
                <p>
                  Cada término encontrado en título, descripción o ítems suma 25
                  puntos de afinidad. Una región preferida suma 10, hasta 100.
                </p>
                <p>
                  Este valor sirve para ordenar. No representa una probabilidad
                  de adjudicación ni confirma que puedas participar.
                </p>
                <div class="rp-help-note">
                  <ShieldCheck :size="17" />
                  <p>
                    Notas, tareas, búsquedas y perfil se comparten solo dentro
                    de {{ user.organization }}.
                  </p>
                </div>
              </section>
              <section class="rp-panel rp-panel-body rp-sync-info">
                <h2>Estado de la fuente</h2>
                <p>
                  {{
                    overview?.sync?.message ||
                    'Todavía no se ha ejecutado una sincronización.'
                  }}
                </p>
                <p>
                  Intervalo: {{ overview?.coverage.intervalMinutes }} min ·
                  Hasta {{ overview?.coverage.detailLimit }} detalles por ciclo.
                </p>
                <small
                  >La región corresponde al comprador y puede diferir del lugar
                  de ejecución. El presupuesto solo aparece si la fuente lo
                  publica.</small
                >
              </section>
            </div>
          </div>
          <section class="rp-panel rp-audit">
            <div class="rp-panel-head">
              <h2>Actividad de tu organización</h2>
              <Activity :size="19" />
            </div>
            <div v-if="!auditRows.length" class="rp-panel-body">
              Todavía no hay actividad.
            </div>
            <div v-for="(row, i) in auditRows" :key="i" class="rp-audit-row">
              <strong>{{ row.actor || 'Sistema' }}</strong
              ><span
                >{{ actionLabels[row.action] || row.action }} ·
                {{ row.resource }}</span
              ><small>{{ dateLabel(row.createdAt, true) }}</small>
            </div>
          </section>
        </template>
        <footer class="rp-footer">
          <span>Radar de Pegas <b>por ExpressApps</b></span
          ><span>Datos de la fuente + decisiones de tu equipo.</span>
        </footer>
      </template>
    </template>

    <dialog
      ref="dialog"
      class="rp-detail-dialog"
      aria-labelledby="rp-detail-title"
      @click="$event.target === dialog && dialog?.close()"
    >
      <div v-if="detail" class="rp-detail">
        <header class="rp-detail-head">
          <span class="rp-code">{{ detail.id }}</span
          ><span class="rp-badge" :class="'rp-status-' + detail.status">{{
            statusLabels[detail.status]
          }}</span
          ><button
            class="rp-icon-button"
            aria-label="Cerrar detalle"
            @click="dialog?.close()"
          >
            <X :size="21" />
          </button>
        </header>
        <div v-if="error" class="rp-error" role="alert">
          {{ error
          }}<button class="rp-inline" :disabled="busy" @click="reloadDetail">
            Recargar versión actual
          </button>
        </div>
        <div class="rp-detail-title">
          <span class="rp-eyebrow">{{
            detail.source === 'demo'
              ? 'EJEMPLO FICTICIO'
              : 'LICITACIÓN · ' + (detail.type || 'TIPO SIN INFORMAR')
          }}</span>
          <h2 id="rp-detail-title">{{ detail.title }}</h2>
          <p>
            <Building2 :size="15" />{{
              detail.buyer || 'Organismo sin informar'
            }}
          </p>
          <div class="rp-detail-buttons">
            <button
              v-if="!detail.saved"
              class="rp-primary"
              :disabled="busy"
              @click="saveTender(detail)"
            >
              <Bookmark :size="16" /> Guardar oportunidad</button
            ><a
              v-if="detail.officialUrl"
              class="rp-secondary"
              :href="detail.officialUrl"
              target="_blank"
              rel="noopener noreferrer"
              >Ver en Mercado Público<ExternalLink :size="15" /></a
            ><button class="rp-secondary" @click="copyCode">
              <Copy :size="15" /> Copiar código</button
            ><button
              class="rp-secondary"
              :disabled="busy"
              @click="refreshDetail"
            >
              <RefreshCw :size="15" /> Actualizar detalle
            </button>
          </div>
        </div>
        <div class="rp-detail-body">
          <section>
            <div class="rp-detail-facts">
              <div>
                <span>Presupuesto publicado</span
                ><strong>{{ money(detail) }}</strong>
              </div>
              <div>
                <span>Región del comprador</span
                ><strong>{{ detail.region || 'Sin informar' }}</strong
                ><small>{{ detail.commune }}</small>
              </div>
              <div>
                <span>Fecha de cierre · Chile</span
                ><strong>{{ dateLabel(detail.closesAt, true) }}</strong
                ><button
                  v-if="detail.closesAt"
                  class="rp-inline"
                  @click="calendar"
                >
                  <CalendarDays :size="13" /> Añadir al calendario
                </button>
              </div>
              <div>
                <span>Consultas hasta</span
                ><strong>{{ dateLabel(detail.questionsUntil, true) }}</strong>
              </div>
            </div>
            <h3>Qué están solicitando</h3>
            <p class="rp-long-text">
              {{
                detail.description ||
                'La fuente aún no proporciona descripción en el resumen importado. Actualiza el detalle o consulta las bases oficiales.'
              }}
            </p>
            <div
              v-if="detail.relevance.matched.length"
              class="rp-match-explained"
            >
              <CheckCircle2 :size="18" />
              <div>
                <strong>Por qué aparece en tu radar</strong>
                <p>
                  Coincidencias: {{ detail.relevance.matched.join(', ') }}.
                  Afinidad: {{ detail.relevance.score }}/100.
                </p>
              </div>
            </div>
            <h3>Ítems de la licitación</h3>
            <p v-if="!detail.items.length" class="rp-muted">
              Sin ítems importados. Consulta el detalle oficial.
            </p>
            <article v-for="(item, i) in detail.items" :key="i" class="rp-item">
              <strong>{{ item.name || 'Ítem ' + (i + 1) }}</strong
              ><span>{{ item.quantity }} {{ item.unit }}</span>
              <p>{{ item.description }}</p>
              <small>{{ item.category }}</small>
            </article>
            <div class="rp-help-note">
              <CircleHelp :size="18" />
              <p>
                Importado: {{ dateLabel(detail.fetchedAt, true) }}. No se
                extraen requisitos ni anexos automáticamente. Revisa las bases,
                garantías, visitas obligatorias y plazos directamente en la
                fuente.
              </p>
            </div>
          </section>
          <aside class="rp-tracking">
            <template v-if="detail.saved"
              ><h3>Tu seguimiento</h3>
              <label
                >Etapa<select v-model="draftStage" aria-label="Etapa">
                  <option
                    v-for="[key, label] in stageEntries"
                    :key="key"
                    :value="key"
                  >
                    {{ label }}
                  </option>
                </select></label
              ><label
                >Responsable<input
                  v-model="owner"
                  maxlength="120"
                  placeholder="Nombre del responsable"
              /></label>
              <div class="rp-task-head">
                <h3>
                  Próximos pasos <span>{{ tasksDone }}/{{ tasks.length }}</span>
                </h3>
                <button class="rp-inline" @click="standardTasks">
                  Usar guía
                </button>
              </div>
              <div class="rp-task-progress">
                <span
                  :style="{
                    width: tasks.length
                      ? (tasksDone / tasks.length) * 100 + '%'
                      : '0%',
                  }"
                ></span>
              </div>
              <div v-for="task in tasks" :key="task.id" class="rp-task">
                <label class="rp-checkbox"
                  ><input v-model="task.done" type="checkbox" /><span
                    :class="{ done: task.done }"
                    >{{ task.title
                    }}<small v-if="task.due">{{
                      dateLabel(task.due + 'T12:00:00-03:00')
                    }}</small></span
                  ></label
                ><button
                  class="rp-icon-button"
                  :aria-label="'Eliminar tarea ' + task.title"
                  @click="tasks = tasks.filter((t) => t.id !== task.id)"
                >
                  <X :size="14" />
                </button>
              </div>
              <div class="rp-new-task">
                <input
                  v-model="taskTitle"
                  aria-label="Nueva tarea"
                  maxlength="200"
                  placeholder="Añadir un próximo paso…"
                  @keydown.enter.prevent="addTask"
                />
                <div>
                  <input
                    v-model="taskDue"
                    aria-label="Fecha de la tarea"
                    type="date"
                  /><button
                    class="rp-secondary"
                    :disabled="!taskTitle.trim() || tasks.length >= 100"
                    @click="addTask"
                  >
                    <Plus :size="15" /> Añadir
                  </button>
                </div>
              </div>
              <button
                class="rp-primary rp-full"
                :disabled="busy"
                @click="saveTracking"
              >
                <Check :size="16" /> Guardar seguimiento
              </button>
              <p class="rp-save-hint">
                Etapa, responsable y tareas se guardan con este botón.
              </p>
              <div class="rp-notes">
                <h3>Notas del equipo</h3>
                <article v-for="n in detail.saved.notes" :key="n.id">
                  <p>{{ n.text }}</p>
                  <small
                    >{{ n.author }} · {{ dateLabel(n.createdAt, true) }}</small
                  >
                </article>
                <textarea
                  v-model="note"
                  rows="3"
                  maxlength="4000"
                  aria-label="Nota del equipo"
                  placeholder="Decisiones, dudas o información para tu equipo…"
                /><button
                  class="rp-secondary rp-full"
                  :disabled="busy || !note.trim()"
                  @click="addNote"
                >
                  Registrar nota<Plus :size="15" />
                </button>
              </div>
              <button
                class="rp-danger-link"
                :disabled="busy"
                @click="removeTracking"
              >
                <Trash2 :size="14" /> Quitar seguimiento y sus notas
              </button></template
            >
            <div v-else class="rp-tracking-empty">
              <Bookmark :size="29" />
              <h3>Dale un próximo paso.</h3>
              <p>
                Guarda esta oportunidad para asignar un responsable, preparar
                una lista de tareas y registrar tus decisiones.
              </p>
              <button
                class="rp-primary"
                :disabled="busy"
                @click="saveTender(detail)"
              >
                Empezar seguimiento<ArrowRight :size="16" />
              </button>
            </div>
          </aside>
        </div>
      </div>
    </dialog>

    <dialog
      ref="importDialog"
      class="rp-small-dialog"
      aria-labelledby="rp-import-title"
    >
      <form @submit.prevent="importTender">
        <div class="rp-panel-head">
          <h2 id="rp-import-title">Consultar código oficial</h2>
          <button
            type="button"
            class="rp-icon-button"
            aria-label="Cerrar"
            @click="importDialog?.close()"
          >
            <X :size="20" />
          </button>
        </div>
        <p>
          Importa una licitación que no esté en el conjunto reciente del radar.
          La consulta utiliza tu fuente configurada.
        </p>
        <label
          >Código de licitación<input
            v-model="importCode"
            required
            minlength="3"
            maxlength="80"
            pattern="[A-Za-z0-9_-]+"
            placeholder="1234-5-LE26"
        /></label>
        <p v-if="error" class="rp-error" role="alert">{{ error }}</p>
        <button class="rp-primary rp-full" :disabled="busy">
          {{ busy ? 'Consultando…' : 'Consultar e importar'
          }}<SearchIcon :size="16" />
        </button>
      </form>
    </dialog>
    <dialog
      ref="searchDialog"
      class="rp-small-dialog"
      aria-labelledby="rp-search-title"
    >
      <form @submit.prevent="saveSearch">
        <div class="rp-panel-head">
          <h2 id="rp-search-title">Crear una alerta</h2>
          <button
            type="button"
            class="rp-icon-button"
            aria-label="Cerrar"
            @click="searchDialog?.close()"
          >
            <X :size="20" />
          </button>
        </div>
        <p>
          Se guardarán las palabras, región, organismo, estado y plazo de cierre
          de tu búsqueda.
        </p>
        <label
          >Nombre de la búsqueda<input
            v-model="searchName"
            required
            minlength="2"
            maxlength="80"
            placeholder="Desarrollo web en Valparaíso"
        /></label>
        <p v-if="error" class="rp-error" role="alert">{{ error }}</p>
        <button class="rp-primary rp-full" :disabled="busy">
          Guardar búsqueda y activar alerta<Bell :size="16" /></button
        ><small>Las notificaciones aparecen dentro de Radar de Pegas.</small>
      </form>
    </dialog>
    <dialog
      ref="securityDialog"
      class="rp-small-dialog"
      aria-labelledby="rp-security-title"
    >
      <form @submit.prevent="changePassword">
        <div class="rp-panel-head">
          <h2 id="rp-security-title">Cambiar contraseña</h2>
          <button
            type="button"
            class="rp-icon-button"
            aria-label="Cerrar"
            @click="securityDialog?.close()"
          >
            <X :size="20" />
          </button>
        </div>
        <label
          >Contraseña actual<input
            v-model="currentPassword"
            type="password"
            autocomplete="current-password"
            required
            maxlength="256" /></label
        ><label
          >Nueva contraseña<input
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            required
            minlength="14"
            maxlength="256"
        /></label>
        <p>Usa al menos 14 caracteres. Se cerrarán todas tus sesiones.</p>
        <p v-if="error" class="rp-error" role="alert">{{ error }}</p>
        <button class="rp-primary rp-full" :disabled="busy">
          Actualizar contraseña<KeyRound :size="16" />
        </button>
      </form>
    </dialog>
    <div v-if="message" class="rp-toast" role="status">
      <CheckCircle2 :size="18" />{{ message
      }}<button
        class="rp-icon-button"
        aria-label="Cerrar notificación"
        @click="message = ''"
      >
        <X :size="15" />
      </button>
    </div>
  </div>
</template>
