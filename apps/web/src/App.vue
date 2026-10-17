<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Blocks, Check, ChevronRight,
  LayoutGrid, Menu, ShieldCheck, Sparkles
} from 'lucide-vue-next'
import { apps } from './data/catalog'
import VenceYa from './components/VenceYa.vue'
import CobroListo from './components/CobroListo.vue'

const current = ref('inicio')
const mobileOpen = ref(false)
const selected = computed(() => apps.find(app => app.slug === current.value))

function navigate(target: string) {
  current.value = target
  mobileOpen.value = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar" :class="{ 'sidebar-open': mobileOpen }">
      <button class="brand" @click="navigate('inicio')">
        <span class="brand-mark"><Blocks :size="21" :stroke-width="2.35" /></span>
        <span class="brand-word">express<span>apps</span><small>by ExpressWebsite</small></span>
      </button>

      <div class="sidebar-section-label">ESPACIO DE TRABAJO</div>
      <nav aria-label="Navegación principal" class="nav-list">
        <button class="nav-link" :class="{ active: current === 'inicio' }" @click="navigate('inicio')">
          <LayoutGrid :size="18" /> <span>Panorama general</span>
        </button>
      </nav>
      <div class="sidebar-section-label apps-label">MICROAPLICACIONES <span>06</span></div>
      <nav aria-label="Microaplicaciones" class="nav-list">
        <button v-for="app in apps" :key="app.slug" class="nav-link" :class="{ active: current === app.slug }" @click="navigate(app.slug)">
          <span class="nav-initials" :style="{ background: app.color }">{{ app.initials }}</span>
          <span>{{ app.name }}</span>
          <span v-if="app.availability === 'local'" class="nav-live-dot" title="MVP local disponible"></span>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <div class="build-note"><span class="build-status"></span><span>Laboratorio de producto<br /><small>Versión inicial · sin backend</small></span></div>
        <p>Software pequeño.<br />Problemas resueltos.</p>
      </div>
    </aside>
    <button v-if="mobileOpen" class="mobile-overlay" aria-label="Cerrar menú" @click="mobileOpen = false"></button>

    <main class="main">
      <div class="topbar">
        <button class="mobile-menu" aria-label="Abrir menú" @click="mobileOpen = true"><Menu :size="22" /></button>
        <div class="breadcrumbs">
          <span>EXPRESSAPPS</span><ChevronRight :size="13" /><strong>{{ selected?.name || 'Panorama general' }}</strong>
        </div>
        <div class="topbar-right"><span class="local-pill"><span></span> Entorno local</span><span class="top-avatar" title="Sin cuenta conectada">EA</span></div>
      </div>

      <div v-if="current === 'inicio'" class="content">
        <div class="hero">
          <div class="hero-text">
            <div class="eyebrow"><Sparkles :size="15" /> UN UNIVERSO DE HERRAMIENTAS ÚTILES</div>
            <h1>Menos software.<br /><em>Más soluciones.</em></h1>
            <p>Un ecosistema de aplicaciones especializadas para sacar del camino el trabajo repetitivo. Una tarea concreta, resuelta de verdad.</p>
            <button class="hero-cta" @click="navigate('venceya')">Explorar VenceYa <ArrowUpRight :size="18" /></button>
          </div>
          <div class="hero-art" aria-hidden="true">
            <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
            <span class="orb orb-one">VY</span><span class="orb orb-two">CF</span><span class="orb orb-three">CL</span>
            <div class="hero-art-center"><Blocks :size="48" :stroke-width="1.35" /></div>
            <div class="art-label">UN PRODUCTO.<br />MIL POSIBILIDADES.</div>
          </div>
        </div>

        <section class="section intro-section">
          <div class="section-eyebrow">ESTADO DEL PROYECTO / 001</div>
          <div class="overview-grid">
            <div class="overview-number"><b>06</b><span>Microapps en el universo</span></div>
            <div class="overview-number"><b>02</b><span>Módulos locales funcionales</span></div>
            <div class="overview-number"><b>04</b><span>En planificación</span></div>
            <div class="overview-message">
              <ShieldCheck :size="20" />
              <p>Etapa de desarrollo. Todavía no se pueden crear cuentas, recibir cobros ni enviar alertas. Los datos de VenceYa y CobroListo se guardan únicamente en este navegador.</p>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <div><div class="section-eyebrow">TU CAJA DE HERRAMIENTAS</div><h2>Cada problema tiene <i>su app.</i></h2></div>
            <div class="section-caption">Seis productos. Una visión.</div>
          </div>
          <div class="catalog-grid">
            <button v-for="(app, index) in apps" :key="app.slug" class="app-card" :style="{ '--card-tint': app.color }" @click="navigate(app.slug)">
              <div class="app-card-top"><span class="app-category">{{ app.category }}</span><ArrowUpRight :size="19" /></div>
              <div class="app-icon">{{ app.initials }}</div>
              <span class="app-index">0{{ index + 1 }} / 06</span>
              <h3>{{ app.name }}</h3><p>{{ app.description }}</p>
              <div class="app-card-bottom">
                <span :class="app.availability === 'local' ? 'state-ready' : 'state-soon'">{{ app.availability === 'local' ? 'MVP local' : 'Planificada' }}</span>
                <span class="app-arrow"><ArrowRight :size="18" /></span>
              </div>
            </button>
          </div>
        </section>
        <footer class="footer"><span>© ExpressApps · Laboratorio de productos digitales</span><span>Diseñado para crecer sin complicarse.</span></footer>
      </div>

      <div v-else-if="current === 'venceya'" class="content content-app">
        <button class="back-button" @click="navigate('inicio')"><ArrowLeft :size="16" /> Universo de aplicaciones</button>
        <VenceYa />
      </div>

      <div v-else-if="current === 'cobrolisto'" class="content content-app">
        <button class="back-button" @click="navigate('inicio')"><ArrowLeft :size="16" /> Universo de aplicaciones</button>
        <CobroListo />
      </div>

      <div v-else-if="selected" class="content content-detail">
        <button class="back-button" @click="navigate('inicio')"><ArrowLeft :size="16" /> Universo de aplicaciones</button>
        <div class="detail-cover" :style="{ '--detail-tint': selected.color }">
          <div class="detail-top"><span>{{ selected.category.toUpperCase() }}</span><span>PRODUCTO EN PLANIFICACIÓN</span></div>
          <span class="detail-initials">{{ selected.initials }}</span>
          <h1>{{ selected.name }}</h1>
          <p>{{ selected.eyebrow }}</p>
        </div>
        <div class="detail-layout">
          <div><div class="section-eyebrow">EL PROBLEMA QUE RESUELVE</div><h2>{{ selected.description }}</h2><p class="detail-audience">Pensada para: {{ selected.target }}</p></div>
          <div class="feature-box"><span class="section-eyebrow">ALCANCE FUNCIONAL PREVISTO</span><div v-for="feature in selected.features" :key="feature" class="feature-row"><span><Check :size="16" /></span>{{ feature }}</div><div class="coming-soon">Todavía no está implementada ni disponible para contratar. Consulta docs/PRODUCTOS.md para su especificación.</div></div>
        </div>
        <footer class="footer"><span>ExpressApps / {{ selected.name }}</span><span>Una aplicación a la vez, bien hecha.</span></footer>
      </div>
    </main>
  </div>
</template>
