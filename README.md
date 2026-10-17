# ExpressApps

Universo de **seis microapps SaaS** para empresas chilenas, con una marca y una arquitectura compartidas.

**Estado actual:** base web ejecutable + catálogo de las seis aplicaciones + primer módulo funcional de **VenceYa en modo local de desarrollo**. Las otras cinco aplicaciones están especificadas, pero todavía no implementadas. No hay autenticación, cobros, backend, envío real de alertas ni almacenamiento de documentos: no se debe comercializar ni usar con datos confidenciales en este estado.

## Aplicaciones

| Microapp | Problema | Estado |
|---|---|---|
| VenceYa | Vencimientos de documentos y obligaciones | MVP local inicial |
| CotizaFollow | Seguimiento de cotizaciones | Especificada |
| CobroListo | Cuentas por cobrar | Especificada |
| DocExtract | Extracción de datos de documentos | Especificada |
| RenuevaPro | Renovación de servicios recurrentes | Especificada |
| CertiQR | Emisión y verificación de certificados | Especificada |

## Arranque

Requiere Node.js 20.19+ o 22+ y npm.

1. Clona el repositorio.
2. Ejecuta npm install en la raíz.
3. Ejecuta npm run dev.
4. Abre la dirección que muestra Vite (habitualmente http://localhost:5173).

Comandos: npm run dev, npm run test, npm run typecheck y npm run build.

## Qué permite hacer VenceYa hoy

- Crear, editar, buscar, filtrar y eliminar registros de vencimiento.
- Calcular los estados vigente, por vencer y vencido.
- Exportar CSV con protección básica frente a inyección de fórmulas.
- Guardar registros **solo en localStorage del navegador**.

No carga archivos; únicamente registra metadatos. No envía correos. No hay cuentas ni multiempresa. Los registros pueden perderse si se borran los datos del navegador.

## Documentación

- docs/PRODUCTOS.md: alcance funcional de las seis microapps.
- docs/ARQUITECTURA.md: diseño evolutivo y decisiones técnicas.
- docs/ROADMAP.md: hitos y requisitos de aceptación.
- docs/SEGURIDAD.md: controles necesarios antes del uso real.
- docs/MODELO_COMERCIAL.md: hipótesis de cobro y métricas.

## Principio de desarrollo

Cada producto debe resolver una tarea específica de extremo a extremo. El portal y la capa de cuentas/cobros serán compartidos. No añadir nuevas funciones antes de completar y comprobar los flujos esenciales del módulo anterior.

> Aviso: los precios son hipótesis comerciales. Esta versión es un punto de partida técnico, no un SaaS en producción.
