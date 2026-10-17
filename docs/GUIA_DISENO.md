# ExpressApps — Guía de diseño y experiencia de producto
**Versión 1.0 · Octubre de 2026**

> Documento normativo para todas las pantallas nuevas. Preservar la identidad visual existente; evolucionarla con criterio, sin reconstruirla desde cero por cada microapp.

## 1. Idea central

**ExpressApps es una caja de herramientas digital con personalidad.** Una herramienta resuelve una tarea específica; el conjunto es una misma familia. Nuestro diseño debe expresar *claridad, control, velocidad y precisión* sin resultar corporativo, infantil o genérico.

La dirección creativa es **editorial, utilitaria y cálida**: tipografía expresiva, aire generoso, densidad informativa en los lugares correctos, tintes naturales, acentos marcados y una jerarquía fácil de leer.

Referencias del lenguaje **ya implementado**:
- Navegación lateral fija con logotipo, catálogo y estado del entorno.
- Portada verde bosque con composición orbital, tipografía grande y acento verde lima.
- Superficies marfil y claras con bordes finos.
- Tarjetas de catálogo reconocibles por siglas y color propio.
- VenceYa: tabla de registros, métricas, filtros, formulario y estados de vencimiento.

**Sello memorable:** *cada microapp tiene una identidad propia y un gesto visual distintivo sin abandonar el mismo sistema de trabajo*. La interfaz debe poder reconocerse como ExpressApps sin necesidad de leer el logo.

## 2. Principios que nunca deben romperse

1. **Función antes que espectáculo.** La tarea principal debe completarse sin aprender un sistema nuevo.
2. **Expresivo en marketing, preciso en operación.** Portada y catálogo pueden ser atrevidos; tablas, formularios y flujos financieros deben ser sobrios.
3. **Una sola acción dominante por pantalla.** Prioridad clara: primario, secundario y terciario.
4. **Un sistema, varias personalidades.** Compartir estructura, escala, componentes y comportamiento; diferenciar cada app mediante color de acento, siglas y elementos gráficos funcionales.
5. **No fabricar confianza.** No inventar resultados, ingresos, pruebas superadas, funcionalidades disponibles ni datos de ejemplo presentados como reales.
6. **Usabilidad por encima de cualquier efecto.** La interfaz debe ser rápida y accesible incluso sin animación y en equipos modestos.
7. **Producto real, no maqueta.** Cada control visible debe funcionar o estar identificado explícitamente como una función futura.

## 3. Identidad visual actual

### Colores base (referencias del CSS existente)

| Token conceptual | Valor HEX | Uso |
|---|---|---|
| Forest / núcleo | \`#1B2922\` | Hero, grandes zonas oscuras |
| Forest / acción | \`#273B2C\` | Botones primarios y acción |
| Ink / texto | \`#1B2520\` | Títulos, texto de alta prioridad |
| Canvas / fondo | \`#F7F7F3\` | Fondo del workspace |
| Surface / panel | \`#FFFFFF\` | Superficies actuales |
| Lime / identidad | \`#C8EE8C\` | Logo y acento central |
| Lime / botón hero | \`#CDF096\` | CTA de alto impacto |
| Mint / selección | \`#EAF2DF\` | Navegación activa |
| Green / énfasis | \`#5D9447\` | Nombre de marca / acento |
| Border / separación | \`#E7EAE4\` | Delimitación suave |
| Muted / texto | \`#79877D\` | Texto secundario, verificar contraste |

Estos valores reflejan el código actual: no están todavía centralizados en variables CSS. Al refactorizar, reemplazar literales por tokens sin alterar el aspecto existente de forma involuntaria.

**Propuesta de tokens para incorporar gradualmente:**

\`\`\`css
:root {
  --ea-bg: #f7f7f3;
  --ea-surface: #ffffff;
  --ea-ink: #1b2520;
  --ea-forest: #1b2922;
  --ea-action: #273b2c;
  --ea-lime: #c8ee8c;
  --ea-selection: #eaf2df;
  --ea-border: #e7eae4;
  --ea-muted: #657168;
  --ea-danger: #a53a32;
  --ea-radius-sm: 8px;
  --ea-radius-md: 12px;
  --ea-radius-lg: 18px;
}
\`\`\`

Un color pastel **no** debe utilizarse automáticamente para textos o botones. Usar siempre combinaciones con contraste suficiente. Evitar blanco puro y negro puro *en nuevas composiciones* cuando una variante matizada sea más coherente; el CSS actual contiene superficies blancas que deben revisarse por componente, no cambiarse en bloque.

### Identidad por microapp

| Producto | Acento inicial | Siglas | Carácter |
|---|---|---|---|
| VenceYa | \`#DDF5C5\` | VY | Calmado, anticipatorio, ordenado |
| CotizaFollow | \`#F3DAFF\` | CF | Comercial, dinámico, orientado a avance |
| CobroListo | \`#FFE2C6\` | CL | Preciso, confiable, financiero |
| DocExtract | \`#D5E8FD\` | DE | Técnico, verificable, documental |
| RenuevaPro | \`#E6E1FE\` | RP | Cíclico, planificado, estable |
| CertiQR | \`#FDEDBF\` | CQ | Editorial, certificador, formal |

**Regla:** color de producto para identificar y acentuar, no para pintar toda la interfaz. En las seis apps, encabezados, navegación, formularios y estados de error obedecen los mismos patrones de ExpressApps.

### Estados semánticos

- Éxito / vigente: verde con etiqueta y, cuando aporte, indicador.
- Advertencia / por vencer: ámbar.
- Error / vencido: rojo contenido.
- Informativo: neutro o azul suave, según contexto.
- Deshabilitado: diferencia visible tanto en color como en comportamiento; explicar el motivo.
- **Nunca codificar estado únicamente con color.** Acompañar con texto.

## 4. Tipografía

Familias actuales:
- **Manrope**: títulos, cifras principales y momentos editoriales.
- **DM Sans**: navegación, párrafos, campos, tablas y texto funcional.
- **Georgia italic**, muy ocasional: contrapunto editorial (*no* para datos y controles).

Normas:
- Headline de landing: \`clamp(2.5rem, 5vw, 4.25rem)\`.
- Título de página: \`clamp(2rem, 3.5vw, 3.5rem)\`.
- Título de sección: \`clamp(1.5rem, 2.5vw, 2.2rem)\`.
- Subtítulos: 1.1–1.4rem.
- Texto principal: 0.875–1rem (14–16 px).
- Datos y tablas: 0.8125–0.9375rem (13–15 px).
- Metadatos esenciales: **mínimo 12 px**. Los rótulos de 9–10 px presentes en la versión inicial se consideran deuda de accesibilidad: aumentar sin romper la jerarquía.
- Interlineado operativo: 1.4–1.55; lectura larga: 1.55–1.7.
- Máximo aproximado de 65–75 caracteres por línea en texto extenso.
- Evitar títulos innecesariamente centrados o un peso 800 aplicado a toda la página.

**Contraste visual:** grandes titulares y cifras contra copy funcional más pequeño. La diferencia de importancia debe ser deliberada, no producto de añadir sombras o colores sin motivo.

## 5. Geometría, grilla y espacio

### Estructura principal

- Sidebar desktop actual de 258 px.
- Topbar actual de 72 px.
- Contenido con ancho máximo de 1560 px.
- Conservar estas medidas mientras no haya una razón funcional demostrable para modificarlas.
- Padding de contenido actual cercano a 47 px en pantallas amplias y 26 px en medianas, 15 px en móviles.
- Utilizar una escala de espacios: 4, 8, 12, 16, 24, 32, 48, 64 y 96 px. Permitir ajustes ópticos puntuales.

### Jerarquía

- Portadas: una zona de impacto, asimetría y aire; evitar un mosaico de tarjetas clonadas.
- Dashboards: resumen al principio *solo si aporta decisiones*.
- Operación: controles de filtro compactos junto a tabla/lista, sin paneles superfluos.
- Formularios: agrupación por significado, etiquetas persistentes y errores junto al campo.
- Pantallas vacías: demostrar el primer paso. Estado vacío ≠ gráfico decorativo sin acción.

**Anti-patrón:** una tarjeta dentro de otra tarjeta dentro de otra; abusar de bordes redondeados, sombras estándar o seis bloques idénticos con icono grande, título y texto.

## 6. Componentes de la familia

Crear y reutilizar progresivamente:
1. \`AppShell\`: navegación principal, breadcrumbs, estado de cuenta/entorno.
2. \`AppHeader\`: siglas de la microapp, título, descripción corta, CTA de prioridad.
3. \`Button\`: primary, secondary, ghost, danger; tamaños coherentes.
4. \`StatusBadge\`: etiqueta + variante semántica, sin depender solo del color.
5. \`Metric\`: valor, unidad, descripción, fecha de actualización y fuente.
6. \`DataTable\`: sorting, filtros, vacíos, loading, paginación, navegación por teclado.
7. \`Field\`: label, ayuda contextual, error y estado deshabilitado.
8. \`EmptyState\`: explicación y siguiente acción.
9. \`InlineFeedback\`: guardado, error, advertencia y éxito.
10. \`ConfirmDialog\`: **solo** para destrucciones y decisiones de alto riesgo; los formularios deben preferir páginas o paneles cuando aumenten de complejidad.

No construir una librería de componentes gigantesca antes de necesitarla. Extraer componentes cuando dos pantallas compartan estructura o comportamiento real.

## 7. Patrones funcionales

### Tablas y filtros
- Información crítica siempre visible: nombre, estado, fecha, responsable, acciones.
- Acciones peligrosas separadas de navegación y edición.
- Filtros persistentes mientras se navega o, si se decide lo contrario, con comportamiento consistente.
- En móvil, cuando la tabla deja de ser utilizable: tarjetas en lista con los mismos datos y acciones, no esconder columnas críticas silenciosamente.
- Indicar zona horaria y formato de fecha en operaciones sensibles.

### Formularios
- Etiquetas visibles, ejemplos útiles, obligatorios señalados.
- Validación precisa, mensaje al campo y resumen si el error impide guardar.
- Mensajes claros sobre si los datos se guardaron, y dónde.
- Evitar modales para flujos largos. VenceYa mantiene hoy un modal de entrada simple, que puede migrarse a un drawer o vista dedicada cuando crezca.
- Confirmación antes de borrar y mecanismo para evitar dobles envíos.
- No generar éxito optimista si el guardado persistente falló.

### Estados de interfaz
Toda pantalla nueva debe contemplar: sin datos, cargando, con datos, vacío tras aplicar filtros, error recuperable, sin permiso, límite de plan agotado, servicio externo no disponible, operación concluida y desconexión.

### Privacidad, pagos y demos
- Distinguir siempre \`Demo local\`, \`Próximamente\` y \`Disponible\`.
- No pedir datos reales si no existe persistencia segura y protección suficiente.
- Un cobro en demo nunca debe parecer un cobro real.
- Números financieros deben indicar período, moneda e interpretación (cobrado / estimado / contratado).

## 8. Movimiento e interacción

- Animaciones para comunicar jerarquía, cambio de estado o éxito: no animar por animar.
- Duraciones guía: 120–180 ms feedback inmediato; 180–260 ms transiciones; 300–450 ms entrada de sección.
- Easing recomendable: \`cubic-bezier(0.22, 1, 0.36, 1)\`.
- Preferir transform y opacity; evitar animar height, width o márgenes salvo necesidad real.
- Un solo gesto protagonista por pantalla: p. ej., encabezado con entrada escalonada o gráfico funcional relevante.
- Respetar \`prefers-reduced-motion\` y mantener toda función disponible sin movimiento.
- Hover, focus-visible, active, disabled, loading y success: cada botón los necesita según caso.

## 9. Responsive / accesibilidad

- Pantallas objetivo: 360 px, 390 px, 768 px, 1024 px, 1440 px.
- Adaptar la estructura, no simplemente encogerla; navegación móvil con cierre accesible y foco manejado correctamente.
- Tamaño de targets táctiles recomendado: al menos 44×44 px cuando sea viable.
- Foco de teclado claro y visible; navegación y diálogos con manejo de foco.
- Contraste WCAG 2.2 AA: 4.5:1 texto normal, 3:1 texto grande y elementos visuales esenciales donde aplique.
- Nunca usar solo color para expresar estado.
- Etiquetas accesibles, avisos de errores en regiones anunciables, tablas semánticas.
- Pruebas con teclado, zoom al 200%, móvil y \`prefers-reduced-motion\`.
- Revisar los rótulos pequeños y grises actuales antes de dar por terminada accesibilidad.

## 10. Dirección por producto: gesto visual particular

### VenceYa — "El tiempo está bajo control"
Un calendario longitudinal o línea temporal puede convertirse en gesto visual: fechas alineadas, urgencia perceptible sin alarmismo, próxima fecha muy clara. Tabla como herramienta principal.

### CotizaFollow — "Nada se pierde entre enviado y aceptado"
Una trayectoria visual sobria (enviada → seguimiento → aceptada), con vista pipeline opcional. Destacar el **siguiente paso** antes que métricas vanidosas.

### CobroListo — "Claridad sobre el dinero"
Diseño sobrio, cifras tabulares alineadas, separación estricta entre por cobrar y cobrado. La interfaz no debe parecer una app bancaria falsa.

### DocExtract — "Fuente junto al dato"
Split-view: documento original a un lado, extracción editable al otro. Resaltar correspondencia entre campo y fuente, con incertidumbre visible.

### RenuevaPro — "Continuidad"
Vista calendario y lista por próximos hitos; estados temporales, ciclos, frecuencia y responsable claramente visibles.

### CertiQR — "Documento verificable"
Editor de certificado con vista previa a escala y zona de impresión real. Verificación pública discreta y confiable; identidad del emisor por encima del ornamento.

## 11. Lo que no debe producir la IA de desarrollo

- Plantillas genéricas de "startup SaaS" repetidas en cada módulo.
- Gradientes púrpura-azul, neones decorativos, glassmorphism, brillos innecesarios.
- Íconos grandes encerrados en cuadrados redondeados sobre cada encabezado.
- Estadísticas falsas para llenar espacio.
- Tablas con 10 px ilegibles como única visualización.
- Tarjetas idénticas en mosaicos infinitos.
- Variables mágicas y diseños inline sin tokens.
- Botones sin comportamiento o secciones "en vivo" sin datos reales.
- Animaciones que sacrifican lectura, rendimiento o accesibilidad.

## 12. Revisión de calidad antes de fusionar

Una pantalla nueva debe responder satisfactoriamente:
- ¿Reconozco ExpressApps sin ver el logo?
- ¿Tiene una acción principal clara y útil?
- ¿El estilo distintivo mejora la tarea, o solo añade decoración?
- ¿Se ve cuidado en 390 px y 1440 px?
- ¿La tipografía y el contraste son legibles?
- ¿Estados vacíos, de error y de carga están resueltos?
- ¿Todos los controles actúan sobre datos verdaderos?
- ¿No presenta funciones futuras como implementadas?
- ¿Reutiliza componentes y tokens sin romper la UI existente?
- ¿Tiene una demostración visual verificable (captura local o preview) y pruebas funcionales adecuadas?

## 13. Cómo construir una nueva microapp

1. Leer \`docs/PRODUCTOS.md\`, \`docs/ARQUITECTURA.md\`, este documento y el código de VenceYa.
2. Identificar la tarea central del producto, la entidad de negocio principal y el criterio de éxito.
3. Definir mapa de estados y pantallas sin escribir CSS todavía.
4. Diseñar la composición principal utilizando AppShell, los componentes compartidos y el color propio.
5. Crear el flujo funcional completo con datos persistentes adecuados a la fase.
6. Incorporar filtros, vacíos, errores, validación, accesibilidad y responsive.
7. Añadir pruebas y revisar impacto en el resto de aplicaciones.
8. Actualizar documentación de estado: implementado / demo / planificado.
9. Solicitar revisión mediante pull request hacia \`main\` cuando el cambio sea estable.

**Prioridad de desarrollo prevista:** consolidar VenceYa y los servicios compartidos, luego CotizaFollow, CobroListo, RenuevaPro, DocExtract y CertiQR. Esta prioridad puede cambiar por demanda validada, no por entusiasmo estético.

---

**Fuente de verdad actual para colores y layout:** \`apps/web/src/styles.css\`. **Fuente de verdad funcional:** \`docs/PRODUCTOS.md\`. Los ejemplos propuestos en esta guía son objetivos de evolución y deben convertirse en código únicamente cuando aporten al flujo real.
