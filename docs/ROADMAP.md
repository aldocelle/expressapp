# Hoja de ruta

## Fase 0 · Base del repositorio
- [x] Estructura workspace npm.
- [x] Portal Vue con catálogo de seis microapps.
- [x] Fichas de alcance de cada producto.
- [x] VenceYa MVP local: crear, editar, eliminar, filtrar y exportar registros.
- [x] Pruebas unitarias de estados y CSV incorporadas al código.
- [ ] Verificar build, typecheck y ejecución de pruebas en CI.

## Fase 1 · Identidad y multiempresa
- [ ] API Node TypeScript.
- [ ] MySQL/MariaDB y migraciones versionadas.
- [ ] Registro, login, verificación, recuperación de cuenta.
- [ ] Organizaciones, miembros, roles y permisos por objeto.
- [ ] Pruebas de aislamiento entre organizaciones.
- [ ] Logs, control de errores y trazabilidad.
- [ ] Backups y restauración probada.

## Fase 2 · VenceYa comercial
- [ ] Sustituir localStorage por API segura.
- [ ] Adjuntos privados, versiones y fechas de emisión.
- [ ] Alertas configurables mediante cola de trabajos y correo.
- [ ] Exportación e importación de registros.
- [ ] Planes, cuotas y suscripción recurrente verificada.
- [ ] Panel operativo; políticas de privacidad y tratamiento de datos.
- [ ] QA de flujos completos con usuarios reales de prueba.

## Fases 3 a 7 · Productos siguientes
- CotizaFollow -> CobroListo -> RenuevaPro -> DocExtract -> CertiQR.
- Prioridad sujeta a validar venta, frecuencia de uso, soporte y margen por producto.

## Criterios mínimos para declarar cualquier producto disponible
- Persistencia real y copia de seguridad.
- Aislamiento por organización, autorización y validación servidor.
- Flujos principales funcionales, probados y accesibles.
- Plan, cobros y límites de consumo transparentes.
- Errores visibles y recuperación documentada.
- Política de datos y soporte establecidos.

No hacer pasar el MVP local por una plataforma SaaS operativa.
