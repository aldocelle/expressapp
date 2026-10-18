# ExpressApps

Universo de **microapps SaaS** para empresas chilenas, con una marca y una arquitectura compartidas.

**Estado actual:** Radar de Pegas implementado con frontend, servidor, cuentas por organización, SQLite, seguimiento y alertas internas. Requiere configurar ticket y despliegue para datos reales. VenceYa sigue siendo un MVP local. Los demás módulos continúan planificados.

## Radar de Pegas

Abrir `/#radar-de-pegas`. Guía completa de instalación, provisión de usuarios, integración, pruebas, seguridad y despliegue: [docs/RADAR_DE_PEGAS.md](docs/RADAR_DE_PEGAS.md).

```sh
npm ci
cp .env.example .env
# Configurar usuario con variables privadas y npm run radar:user.
npm run dev:api
# En otra terminal:
npm run dev
```

El modo real no inventa resultados cuando falta el ticket. Para explorar con ejemplos, configurar explícitamente `RADAR_DEMO=true`. No hay credenciales predeterminadas. No se envían correos ni WhatsApp. No se ha conectado un ticket real ni desplegado un servicio público en esta entrega.

## Aplicaciones

| Microapp | Problema | Estado |
|---|---|---|
| Radar de Pegas | Licitaciones y seguimiento comercial | Implementado; requiere configuración |
| VenceYa | Vencimientos de documentos y obligaciones | MVP local inicial |
| CotizaFollow | Seguimiento de cotizaciones | Especificada |
| CobroListo | Cuentas por cobrar | Especificada |
| DocExtract | Extracción de datos de documentos | Especificada |
| RenuevaPro | Renovación de servicios recurrentes | Especificada |
| CertiQR | Emisión y verificación de certificados | Especificada |

## Arranque

Requiere Node.js 22.13+ y npm (recomendado Node 24 LTS).

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

> Aviso: los precios son hipótesis comerciales. El código implementado no equivale a un servicio desplegado y validado con clientes.
