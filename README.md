# ExpressApps

Universo de **seis microapps SaaS** para empresas chilenas, con una marca y una arquitectura compartidas.

**Estado actual:** base web Vue + catálogo de seis aplicaciones + **cuatro módulos locales de desarrollo: VenceYa, CobroListo, RenuevaPro y DocExtract**. Las dos restantes están especificadas, todavía no implementadas. No hay autenticación, cobros en línea, backend, envío real de alertas ni almacenamiento de documentos: no comercializar ni usar con datos confidenciales en este estado.

## Aplicaciones

| Microapp | Problema | Estado |
|---|---|---|
| VenceYa | Vencimientos de documentos y obligaciones | MVP local inicial |
| CotizaFollow | Seguimiento de cotizaciones | Especificada |
| CobroListo | Cuentas por cobrar | MVP local inicial |
| DocExtract | Extracción de datos de documentos | MVP local inicial |
| RenuevaPro | Renovación de servicios recurrentes | MVP local inicial |
| CertiQR | Emisión y verificación de certificados | Especificada |

## Arranque

Requiere Node.js 20.19+ o 22+ y npm.

1. Clona el repositorio.
2. Ejecuta npm install en la raíz.
3. Ejecuta npm run dev.
4. Abre la dirección que muestra Vite (habitualmente http://localhost:5173).

Comandos: npm run dev, npm run test, npm run typecheck y npm run build.

## Qué permite hacer CobroListo hoy

- Registrar clientes, crear y editar cuentas por cobrar con montos CLP y fechas.
- Registrar y corregir abonos manuales sin permitir sobrepagos.
- Consultar saldos, estados y antigüedad de cuentas vencidas.
- Filtrar por cliente/estado y exportar CSV de cuentas y abonos.
- Los datos permanecen **solo en localStorage**. Sin pasarela bancaria, verificación de transferencias, avisos reales, cuentas ni respaldo remoto.

## RenuevaPro y DocExtract en modo local

**RenuevaPro:** contratos de servicios, valor CLP por período, ciclos mensual/trimestral/semestral/anual, próximas fechas, historial de renovaciones manuales, proyección MRR contractual, filtros y CSV. No envía recordatorios ni realiza cobros.

**DocExtract:** archivos PDF con texto seleccionable (hasta 30 páginas y 10 MB) extraídos localmente con PDF.js; imágenes y escaneos requieren ingresar campos manualmente. Permite revisar fechas, RUT, folio y montos; exportar CSV y JSON. Los originales no se guardan: únicamente los campos y un fragmento de texto se almacenan localmente. No hay OCR real ni integración SII.

## Qué permite hacer VenceYa hoy

- Crear, editar, buscar, filtrar y eliminar registros de vencimiento.
- Calcular los estados vigente, por vencer y vencido.
- Exportar CSV con protección básica frente a inyección de fórmulas.
- Guardar registros **solo en localStorage del navegador**.

No carga archivos; únicamente registra metadatos. No envía correos. No hay cuentas ni multiempresa. Los registros pueden perderse si se borran los datos del navegador.

## Diseño y trabajo con IA en VS Code

- [Guía de diseño y experiencia](docs/GUIA_DISENO.md): paleta, tipografías, componentes, responsive y criterios para cada microapp.
- [Instrucciones para asistentes de código](AGENTS.md): flujo de trabajo y reglas de implementación.
- [Instrucciones para GitHub Copilot](.github/copilot-instructions.md): aplicación de las guías desde VS Code.

**Desarrollo de nuevas apps:** trabajar en la rama `develop/microapps`. Mantener `main` como rama estable.

## Documentación

- docs/PRODUCTOS.md: alcance funcional de las seis microapps.
- docs/ARQUITECTURA.md: diseño evolutivo y decisiones técnicas.
- docs/ROADMAP.md: hitos y requisitos de aceptación.
- docs/SEGURIDAD.md: controles necesarios antes del uso real.
- docs/MODELO_COMERCIAL.md: hipótesis de cobro y métricas.

## Principio de desarrollo

Cada producto debe resolver una tarea específica de extremo a extremo. El portal y la capa de cuentas/cobros serán compartidos. No añadir nuevas funciones antes de completar y comprobar los flujos esenciales del módulo anterior.

> Aviso: los precios son hipótesis comerciales. Esta versión es un punto de partida técnico, no un SaaS en producción.
