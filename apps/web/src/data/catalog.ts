export type AppSlug = 'venceya' | 'cotizafollow' | 'cobrolisto' | 'docextract' | 'renuevapro' | 'certiqr' | 'radar-de-pegas'
export type AppItem = {
  slug: AppSlug
  name: string
  initials: string
  category: string
  eyebrow: string
  description: string
  color: string
  availability: 'local' | 'planned' | 'server'
  features: string[]
  target: string
}

export const apps: AppItem[] = [
  {
    slug: 'radar-de-pegas', name: 'Radar de Pegas', initials: 'RP', category: 'Oportunidades',
    eyebrow: 'Tu próxima oportunidad, con dirección', color: '#D9EADC', availability: 'server',
    description: 'Encuentra licitaciones, prepara propuestas y organiza el seguimiento de tu equipo.',
    target: 'Pymes, consultoras, agencias y proveedores del Estado.',
    features: ['Mercado Público desde servidor', 'Sesiones por organización', 'Búsquedas y alertas internas', 'Seguimiento con notas y tareas']
  },
  {
    slug: 'venceya', name: 'VenceYa', initials: 'VY', category: 'Administración',
    eyebrow: 'Nunca se te pasa una fecha', color: '#DDF5C5', availability: 'local',
    description: 'Centraliza vencimientos de contratos, permisos y documentos en un solo lugar.',
    target: 'Contratistas, administradores, empresas de servicio y pymes.',
    features: ['Registro de vencimientos', 'Estados automáticos por fecha', 'Búsqueda y filtros', 'Exportación CSV']
  },
  {
    slug: 'cotizafollow', name: 'CotizaFollow', initials: 'CF', category: 'Ventas',
    eyebrow: 'Que ninguna propuesta se pierda', color: '#F3DAFF', availability: 'planned',
    description: 'Sigue cotizaciones enviadas, programa recordatorios y mide aceptación.',
    target: 'Técnicos, agencias, consultoras y servicios B2B.',
    features: ['Cotizaciones y versiones', 'PDF con marca', 'Secuencias de seguimiento', 'Tasa de aceptación']
  },
  {
    slug: 'cobrolisto', name: 'CobroListo', initials: 'CL', category: 'Finanzas',
    eyebrow: 'Cobra sin perseguir', color: '#FFE2C6', availability: 'planned',
    description: 'Controla cuentas por cobrar, pagos parciales y saldos pendientes.',
    target: 'Profesionales y pequeñas empresas con ventas a crédito.',
    features: ['Cuentas y saldos', 'Registro de abonos', 'Recordatorios respetuosos', 'Antigüedad de deuda']
  },
  {
    slug: 'docextract', name: 'DocExtract', initials: 'DE', category: 'Documentos',
    eyebrow: 'De archivo a dato útil', color: '#D5E8FD', availability: 'planned',
    description: 'Extrae datos de PDF e imágenes con revisión humana antes de exportar.',
    target: 'Administración, contadores y equipos de compras.',
    features: ['PDF e imágenes', 'OCR cuando haga falta', 'Corrección de campos', 'Exportación estructurada']
  },
  {
    slug: 'renuevapro', name: 'RenuevaPro', initials: 'RP', category: 'Operaciones',
    eyebrow: 'Cuida tus ingresos recurrentes', color: '#E6E1FE', availability: 'planned',
    description: 'Gestiona contratos de servicios y renovaciones sin perder oportunidades.',
    target: 'Mantención, soporte, consultoras y prestadores B2B.',
    features: ['Ciclos de renovación', 'Contratos activos', 'Avisos configurables', 'MRR estimado']
  },
  {
    slug: 'certiqr', name: 'CertiQR', initials: 'CQ', category: 'Certificación',
    eyebrow: 'Emite. Comparte. Verifica.', color: '#FDEDBF', availability: 'planned',
    description: 'Emite certificados PDF y permite verificar su autenticidad mediante QR.',
    target: 'OTEC, academias y organizadores de capacitación.',
    features: ['Plantillas de certificado', 'Emisión por lotes', 'QR verificable', 'Revocación']
  }
]
