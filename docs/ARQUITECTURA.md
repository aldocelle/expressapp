# Arquitectura evolutiva de ExpressApps

## Decisiones vigentes

- El frontend se inicia con Vue 3, TypeScript, Vite y un CSS compartido. No se presenta una SPA demo como si fuera un SaaS multiempresa.
- La primera entrega es deliberadamente local: VenceYa usa localStorage; ese almacenamiento no es seguro para documentos sensibles ni constituye una base de datos comercial.
- Para producción, incorporar una API Node.js/TypeScript (Express) en un monolito modular y MySQL/MariaDB con migraciones. Si se elige alojamiento compartido que no soporte procesos Node permanentes, evaluar PHP/Laravel o un servicio compatible antes de programar tareas.
- Separación por dominios: identidad/organización, facturación, archivos, notificaciones y cada microapp.
- La integración entre microapps debe ser explícita, trazable e idempotente.

## Esquema previsto

La plataforma incorporará: users, organizations, organization_members, roles, app_catalog, organization_apps, plans, subscriptions, payments, usage_events, files, notifications, notification_deliveries, audit_logs.

Entidades propias:

- venceya: documents, document_versions, expiration_policies, alerts.
- cotizafollow: quotes, quote_items, quote_versions, followups.
- cobrolisto: receivables, payments_received, collection_events.
- docextract: extraction_jobs, extraction_fields, extraction_reviews.
- renuevapro: recurring_services, renewal_periods, renewal_events.
- certiqr: templates, certificate_batches, certificates, revocations.

### Reglas transversales

1. Todas las consultas de datos de cliente restringidas por organization_id y autorización específica del recurso.
2. Únicamente el backend gestiona secretos y pagos. Variables de Vite son públicas.
3. Los archivos privados deben permanecer fuera de un directorio público y ofrecerse con URLs limitadas en tiempo y autorización.
4. No ejecutar OCR costoso o envíos masivos dentro de peticiones HTTP sincronizadas; usar jobs con reintentos y protección contra duplicados.
5. Registrar versión de planes, cuotas y cambios de suscripción.
6. Entregar a las empresas exportación y eliminación según normativa y política aplicable.

## Próximo entregable técnico

Reemplazar almacenamiento local de VenceYa por API autenticada y DB, con CRUD por organización, pruebas cross-tenant, jobs de alertas por correo y auditoría básica. Después añadir pagos recurrentes. No procesar datos de clientes reales antes.

## Radar de Pegas (implementación actual)

El dominio Radar incorpora API Express + SQLite local con WAL, sesiones y aislamiento por organización. Es una decisión para una instancia permanente con volumen privado persistente; el diseño MySQL/MariaDB anterior continúa como evolución para otros dominios o mayor escala. La guía específica y sus limitaciones están en RADAR_DE_PEGAS.md. VenceYa conserva su implementación local.
