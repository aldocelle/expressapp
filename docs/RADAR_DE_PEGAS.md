# Radar de Pegas · implementación y operación

## Alcance entregado

Módulo Vue 3 + TypeScript integrado en ExpressApps, API Express y SQLite persistente. Acceso directo: `/#radar-de-pegas`.

- Inicio/cierre de sesión, cambio de contraseña y cuentas provisionadas por CLI.
- Organizaciones aisladas para perfil, seguimiento, notas, tareas, búsquedas, bandeja y auditoría.
- Búsqueda por texto/código, comprador, región del comprador, estado y próximos cierres; orden, paginación y CSV.
- Perfil comercial con términos, exclusiones y regiones; afinidad determinista y explicada. No se presenta como IA ni probabilidad de adjudicación.
- Importación bajo demanda por código, detalle, ítems importados, presupuesto solo cuando se publica, copia de código y archivo de calendario UTC.
- Seguimiento con etapas, responsable de texto libre, notas fechadas y tareas con vencimiento. Versionado optimista contra sobrescrituras.
- Búsquedas guardadas con pausa y alertas internas deduplicadas. Recordatorios de cierre a 48 h y tareas vencidas.
- Sincronización manual/asíncrona y periódica, estado de ejecución, bloqueo entre procesos y conservación del caché ante fallos.
- Modo de demostración explícito y separado del catálogo real.

No incluye facturación SaaS, autoservicio de registro, recuperación por correo, MFA, adjuntos, análisis automático de bases/anexos, postulación en Mercado Público, correo ni WhatsApp. La etapa «Postulada» se registra manualmente; no acredita recepción oficial.

## Requisitos y desarrollo

Node 22.13+ (se recomienda Node 24 LTS), npm. `node:sqlite` forma parte del runtime y puede emitir aviso experimental en algunas versiones. No se requieren servicios MySQL para esta entrega.

```sh
npm ci
cp .env.example .env
```

Para explorar con ejemplos, configurar `RADAR_DEMO=true` en `.env`. No se crean usuarios ni contraseñas predeterminadas. Configurar temporalmente `RADAR_USER_EMAIL`, `RADAR_USER_NAME`, `RADAR_ORG_NAME` y `RADAR_USER_PASSWORD` (14–256 caracteres) en el entorno privado y ejecutar:

```sh
npm run radar:user
```

Eliminar esas variables de provisión del entorno una vez configurada la cuenta. El mismo comando restablece una cuenta existente de esa organización y revoca sus sesiones. Solo un operador con acceso al servidor debe utilizarlo. En esta versión las cuentas provisionadas tienen rol administrador; el backend ya restringe la sincronización por rol, pero no hay gestión de miembros en la interfaz.

Dos terminales:

```sh
npm run dev:api
npm run dev
```

Abrir `http://localhost:5173/#radar-de-pegas`. Vite redirige `/api` a `127.0.0.1:3001`. `APP_ORIGIN` debe coincidir exactamente con el origen visible del navegador (sin barra final). No mezclar `localhost` y `127.0.0.1`.

## Conectar datos reales

1. Solicitar ticket propio siguiendo https://www.chilecompra.cl/api/ y aceptar sus condiciones. No usar tickets publicados como ejemplo en documentación.
2. Establecer `RADAR_DEMO=false` y `MERCADO_PUBLICO_TICKET` exclusivamente en el servidor. Nunca usar `VITE_*` para secretos.
3. Reiniciar el proceso y pulsar «Actualizar fuente» como administrador, o ejecutar `npm run radar:sync`.
4. Comprobar una muestra de códigos, plazos, regiones, montos y enlaces frente al portal oficial antes de habilitar clientes.

### Cobertura y precisión

- Se consultan resúmenes diarios de los últimos `RADAR_SYNC_DAYS` (1–7; predeterminado 3), en formato `ddMMyyyy`, zona `America/Santiago`. No es un catálogo exhaustivo de todas las licitaciones abiertas históricas.
- Cada ciclo enriquece hasta `RADAR_DETAIL_LIMIT` detalles (0–100; predeterminado 30). Prioriza seguimientos antiguos y después resúmenes sin enriquecer. El detalle puede actualizarse bajo demanda con caché de 15 minutos y cuota por organización.
- Intervalo `RADAR_SYNC_MINUTES` (5–1440; predeterminado 30). En despliegues con proceso permanente, el programador vive dentro del servidor. Una CLI permite cron externo. Evitar procesos redundantes; el bloqueo de sincronización usa SQLite y vence a la hora si el proceso termina abruptamente.
- Límite preventivo del cliente: una consulta cada 1,2 segundos, 20 s de timeout, 8 MB por respuesta, sin redirecciones. Ajustar a las condiciones actuales del proveedor, no asumir un SLA.
- No se envía el ticket al navegador ni se registra la URL autenticada en errores. La integración no usa Boostr.
- Un resumen no inventa organismo, descripción, ítems ni monto. Los campos faltantes se presentan como desconocidos. El presupuesto se muestra en su moneda original, sin conversión automática.
- La región es la del comprador, no necesariamente la de ejecución. Las fechas sin zona se interpretan en Chile continental con horario de verano; las que traen offset lo conservan.
- Un cierre pasado deja de aparecer como abierto aunque el estado fuente siga publicado. Una oportunidad no consultada recientemente puede estar revocada/suspendida sin que aún lo sepamos.
- El enlace al portal se genera por código y debe validarse con datos reales. El botón para copiar código permite búsqueda manual si el portal cambia sus URLs.
- No se ha realizado validación de extremo a extremo con un ticket real en esta entrega. Las pruebas del adaptador usan respuestas controladas.

## Alertas

Las búsquedas guardan texto, región, comprador, estado y ventana de cierre. Texto con varias palabras exige todas; la coincidencia ignora mayúsculas y tildes. No guardan el interruptor de afinidad, etapa ni exclusiones de perfil: son filtros independientes, explicado en la interfaz.

Al crear una búsqueda se notifican coincidencias ya importadas, con máximo 20 búsquedas por organización. Las siguientes evaluaciones no duplican la misma coincidencia de búsqueda+código. Las alertas se mantienen como historial aunque se pause/elimine la búsqueda. Cambios de plazo pueden producir un nuevo aviso de cierre. La bandeja muestra las últimas 200 alertas. No implica envío de mensajes fuera de la app.

## Seguridad implementada y límites

- Sesiones opacas aleatorias de 256 bits. Solo su SHA-256 queda en DB. Cookies HttpOnly, SameSite=Lax, Secure en producción, duración absoluta de 12 h.
- Contraseñas con scrypt N=32768, r=8, p=1, salt aleatorio y comparación constante. Login limitado por IP y cálculo equivalente para usuario inexistente. Límites en memoria: se asume una sola instancia; para réplicas se necesita un almacén compartido.
- Origen exacto + Content-Type JSON + token CSRF por sesión para mutaciones. Sin CORS permisivo. No poner una caché delante de `/api`.
- Consultas parametrizadas, validación Zod estricta, límites de tamaño, Helmet/CSP, texto sin HTML y escape de fórmulas en CSV.
- Aislamiento por `org_id` en cada recurso privado. No se publican documentos ni credenciales. Las notas son aditivas y el seguimiento usa control de versión; un conflicto exige recargar.
- Auditoría de eventos principales, no inmutable contra un operador de DB. No almacenar datos confidenciales en las notas sin una política interna.
- Cada organización comparte perfil, búsquedas, notas y seguimiento entre sus usuarios. El nombre de responsable no crea una cuenta ni envía invitaciones.

Antes de usuarios externos: HTTPS real, ticket de producción validado, provisión de acceso, políticas de privacidad/retención, monitorización y respaldo fuera del servidor. Para servicios de mayor criticidad añadir MFA/SSO, revocación de miembros, almacén central de límites y revisión de seguridad independiente. No declarar certificaciones ni garantías de disponibilidad.

## Despliegue en un servidor permanente

```sh
npm ci
npm run build
npm start
```

`npm start` sirve el frontend compilado y la API en un mismo origen. Configurar `NODE_ENV=production`, `APP_ORIGIN=https://radar.tudominio.cl`, `RADAR_DEMO=false`, ticket y una ruta persistente privada para `RADAR_DB_PATH`. El backend escucha en `127.0.0.1` por defecto. Usar proxy HTTPS y supervisor (systemd/contenedor). SQLite usa WAL, claves foráneas y timeout de bloqueo.

El Dockerfile incluido construye web y API y ejecuta como usuario sin privilegios. Publicar el puerto solo detrás de HTTPS. `TRUST_PROXY_HOPS=1` solo si hay exactamente un proxy confiable y el puerto del backend no es accesible directamente desde Internet. No usar hosting estático, filesystem efímero ni múltiples réplicas con un archivo SQLite compartido por red. El despliegue Docker no ha sido ejecutado en este entorno.

## Respaldo y restauración

Definir `RADAR_BACKUP_PATH` como destino absoluto nuevo y privado, y ejecutar:

```sh
npm run radar:backup
```

Genera una instantánea SQLite consistente con `VACUUM INTO`, permisos 0600 e integrity_check. Cifrar/copiar el respaldo fuera del host mediante el sistema de operación elegido; no está automatizado aquí. No copiar únicamente el archivo principal de una DB WAL en uso.

Restaurar con el servicio detenido: comprobar respaldo, conservar la DB anterior, colocar la instantánea en la ruta configurada y retirar los antiguos archivos `-wal`/`-shm` de esa DB detenida. Verificar propiedad/permisos y arrancar. Revocar sesiones si la copia no debe restaurar accesos antiguos (`DELETE FROM sessions` mediante operador autorizado). Ensayar restauración y registrar RPO/RTO antes de producción.

## Validación

```sh
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm audit --omit=dev
```

Pruebas de dominio: fechas chilenas/DST, normalización, exclusiones, cierres y CSV. API: autenticación, origen/CSRF, aislamiento entre organizaciones, concurrencia, búsquedas, notificaciones, separación demo/real y revocación de sesiones. Adaptador: respuesta inválida, límites y fallos sin exposición de ticket. Navegador: login, perfil, búsqueda, seguimiento persistente, tareas, notas, alertas, CSV y layout de escritorio/móvil.

## Verificación de esta entrega

En el entorno de desarrollo pasaron 4 pruebas del módulo existente, 17 pruebas de dominio/API/almacenamiento y 2 flujos completos de navegador (escritorio y móvil). También se comprobó compilación, TypeScript y respaldo/restauración. El análisis de dependencias de producción no informó vulnerabilidades en esta ejecución; no equivale a una auditoría independiente. Los E2E locales se ejecutaron con Chromium disponible por ruta alternativa porque la descarga estándar del navegador no funcionó en este entorno. El workflow utiliza la instalación estándar.

Pendientes externos: ticket propio y pruebas contractuales con datos reales, infraestructura HTTPS/volumen persistente, políticas operativas y ensayo de carga con el volumen esperado. Esta versión calcula búsquedas sobre el caché en memoria del proceso: antes de catálogos o equipos grandes debe medirse y migrarse filtrado/índices/paginación a SQL. No se ejecutó Docker ni se publicó un servicio público.
