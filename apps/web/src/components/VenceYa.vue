<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Check, Download, FileClock, FolderOpen, Pencil, Plus, Search, Trash2, X
} from 'lucide-vue-next'
import {
  exportDocumentsCsv, formatDate, getDocumentStatus,
  readDocuments, writeDocuments, type DocumentCategory, type VenceDocument
} from '../lib/documents'

const documents = ref<VenceDocument[]>(readDocuments())
const search = ref('')
const filter = ref('todos')
const formOpen = ref(false)
const editingId = ref<string | null>(null)
const formError = ref('')
const saveError = ref('')
const categories: DocumentCategory[] = ['Contrato', 'Permiso', 'Seguro', 'Certificado', 'Otro']

const draft = reactive({
  name: '', category: 'Contrato' as DocumentCategory, owner: '',
  expiresOn: '', notes: ''
})

watch(documents, next => {
  try {
    writeDocuments(next)
    saveError.value = ''
  } catch {
    saveError.value = 'No se pudo guardar en este navegador. Verifica su espacio disponible.'
  }
}, { deep: true })

const sorted = computed(() => [...documents.value].sort((a, b) => a.expiresOn.localeCompare(b.expiresOn)))
const visible = computed(() => sorted.value.filter(item => {
  const matchesQuery = [item.name, item.category, item.owner, item.notes]
    .some(value => value.toLocaleLowerCase('es').includes(search.value.toLocaleLowerCase('es')))
  const matchesStatus = filter.value === 'todos' || getDocumentStatus(item.expiresOn) === filter.value
  return matchesQuery && matchesStatus
}))
const totals = computed(() => ({
  all: documents.value.length,
  current: documents.value.filter(x => getDocumentStatus(x.expiresOn) === 'vigente').length,
  soon: documents.value.filter(x => getDocumentStatus(x.expiresOn) === 'por-vencer').length,
  overdue: documents.value.filter(x => getDocumentStatus(x.expiresOn) === 'vencido').length
}))

const labels: Record<string, string> = {
  vigente: 'Vigente', 'por-vencer': 'Por vencer', vencido: 'Vencido'
}

function clearDraft() {
  draft.name = ''; draft.category = 'Contrato'; draft.owner = ''
  draft.expiresOn = ''; draft.notes = ''; formError.value = ''
}

function addNew() {
  clearDraft()
  editingId.value = null
  formOpen.value = true
}

function edit(item: VenceDocument) {
  draft.name = item.name
  draft.category = item.category
  draft.owner = item.owner
  draft.expiresOn = item.expiresOn
  draft.notes = item.notes
  editingId.value = item.id
  formError.value = ''
  formOpen.value = true
}

function save() {
  if (!draft.name.trim() || !draft.owner.trim() || !draft.expiresOn) {
    formError.value = 'Completa el nombre, el responsable y la fecha de vencimiento.'
    return
  }
  const payload = {
    name: draft.name.trim(), category: draft.category, owner: draft.owner.trim(),
    expiresOn: draft.expiresOn, notes: draft.notes.trim()
  }
  if (editingId.value) {
    documents.value = documents.value.map(item =>
      item.id === editingId.value ? { ...item, ...payload } : item
    )
  } else {
    documents.value = [{
      id: crypto.randomUUID(),
      ...payload,
      createdAt: new Date().toISOString()
    }, ...documents.value]
  }
  formOpen.value = false
  clearDraft()
}

function remove(item: VenceDocument) {
  if (window.confirm('¿Eliminar el registro "' + item.name + '"? Esta acción no se puede deshacer.')) {
    documents.value = documents.value.filter(doc => doc.id !== item.id)
  }
}

function download() {
  if (documents.value.length > 0) exportDocumentsCsv(documents.value)
}
</script>

<template>
  <div class="venceya">
    <div class="module-header">
      <div class="module-title-block">
        <div class="module-kicker"><span class="module-icon"><FileClock :size="22" /></span> MICROAPP 01 / ADMINISTRACIÓN</div>
        <h1>Vence<span>Ya.</span></h1>
        <p>Todo vence. Que nada te tome por sorpresa.</p>
      </div>
      <button class="primary-button" @click="addNew"><Plus :size="18" /> Nuevo vencimiento</button>
    </div>

    <div class="demo-disclaimer"><span class="demo-dot"></span><strong>Versión local de desarrollo.</strong> Los registros se guardan solo en este navegador. Todavía no hay archivos adjuntos ni alertas automáticas.</div>
    <div v-if="saveError" class="form-error" role="alert">{{ saveError }}</div>

    <div class="stat-grid">
      <div class="stat-card"><span>Documentos registrados</span><div class="stat-value">{{ totals.all.toString().padStart(2, '0') }} <FolderOpen :size="24" /></div><small>Total de registros</small></div>
      <div class="stat-card"><span>Vigentes</span><div class="stat-value">{{ totals.current.toString().padStart(2, '0') }} <Check :size="24" /></div><small>Más de 30 días restantes</small></div>
      <div class="stat-card"><span>Por vencer</span><div class="stat-value">{{ totals.soon.toString().padStart(2, '0') }} <FileClock :size="24" /></div><small>Dentro de los próximos 30 días</small></div>
      <div class="stat-card"><span>Vencidos</span><div class="stat-value">{{ totals.overdue.toString().padStart(2, '0') }} <X :size="24" /></div><small>Requieren revisión</small></div>
    </div>

    <div class="data-panel">
      <div class="data-header">
        <div><span class="section-eyebrow">CONTROL DOCUMENTAL</span><h2>Mis vencimientos <span>{{ totals.all }}</span></h2></div>
        <button class="secondary-button" :disabled="!totals.all" @click="download"><Download :size="17" /> Exportar CSV</button>
      </div>
      <div class="table-toolbar">
        <label class="search-wrap"><Search :size="18" /><input v-model="search" placeholder="Buscar documento, responsable..." aria-label="Buscar documentos" /></label>
        <select v-model="filter" aria-label="Filtrar por estado" class="filter-select">
          <option value="todos">Todos los estados</option><option value="vigente">Vigentes</option>
          <option value="por-vencer">Por vencer</option><option value="vencido">Vencidos</option>
        </select>
      </div>
      <div v-if="visible.length" class="table-scroll">
        <table class="records-table">
          <thead><tr><th>DOCUMENTO</th><th>CATEGORÍA</th><th>RESPONSABLE</th><th>VENCIMIENTO</th><th>ESTADO</th><th class="actions-heading">ACCIONES</th></tr></thead>
          <tbody>
            <tr v-for="item in visible" :key="item.id">
              <td><strong>{{ item.name }}</strong><span v-if="item.notes" class="table-sub" :title="item.notes">{{ item.notes }}</span></td>
              <td>{{ item.category }}</td><td>{{ item.owner }}</td><td class="date-cell">{{ formatDate(item.expiresOn) }}</td>
              <td><span class="status-chip" :class="'status-' + getDocumentStatus(item.expiresOn)"><span></span>{{ labels[getDocumentStatus(item.expiresOn)] }}</span></td>
              <td class="actions-cell"><button :aria-label="'Editar ' + item.name" :title="'Editar ' + item.name" @click="edit(item)"><Pencil :size="16" /></button><button :aria-label="'Eliminar ' + item.name" :title="'Eliminar ' + item.name" @click="remove(item)"><Trash2 :size="16" /></button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state">
        <span class="empty-illustration"><FileClock :size="34" :stroke-width="1.5" /></span>
        <h3>{{ documents.length ? 'No encontramos coincidencias' : 'Tus vencimientos, bajo control' }}</h3>
        <p>{{ documents.length ? 'Prueba con otra búsqueda o cambia los filtros.' : 'Crea tu primer registro para tener todas tus fechas importantes en un solo lugar.' }}</p>
        <button v-if="!documents.length" class="primary-button" @click="addNew"><Plus :size="17" /> Crear primer registro</button>
        <button v-else class="text-button" @click="search = ''; filter = 'todos'">Limpiar filtros</button>
      </div>
    </div>

    <div v-if="formOpen" class="modal-backdrop" @click.self="formOpen = false">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <div class="modal-head"><div><span class="section-eyebrow">VENCEYA / REGISTROS</span><h2 id="form-title">{{ editingId ? 'Editar vencimiento' : 'Nuevo vencimiento' }}</h2></div><button aria-label="Cerrar formulario" class="close-button" @click="formOpen = false"><X :size="20" /></button></div>
        <form @submit.prevent="save" class="document-form">
          <label>Nombre del documento <span>*</span><input v-model="draft.name" required maxlength="120" placeholder="Ej. Permiso sanitario" /></label>
          <div class="form-grid"><label>Categoría<select v-model="draft.category"><option v-for="category in categories" :key="category">{{ category }}</option></select></label><label>Fecha de vencimiento <span>*</span><input v-model="draft.expiresOn" required type="date" /></label></div>
          <label>Responsable <span>*</span><input v-model="draft.owner" required maxlength="120" placeholder="Ej. Administración" /></label>
          <label>Notas adicionales<textarea v-model="draft.notes" rows="3" maxlength="1000" placeholder="Información que quieras recordar..."></textarea></label>
          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
          <div class="form-foot"><button type="button" class="secondary-button" @click="formOpen = false">Cancelar</button><button type="submit" class="primary-button">{{ editingId ? 'Guardar cambios' : 'Guardar registro' }} <Check :size="16" /></button></div>
        </form>
      </div>
    </div>
  </div>
</template>
