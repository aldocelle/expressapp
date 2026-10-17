# Especificación de las seis microapps

Cada producto es independiente y comparte identidad, organización, notificaciones y facturación. Las funciones de esta lista que no aparecen en el código son **requisitos futuros**, no funciones disponibles.

## 01 VenceYa

Problema: vencimientos olvidados de documentos, seguros, permisos, contratos y certificados.

- Registro de documento: título, categoría, empresa, responsable, fecha de emisión, vencimiento, emisor, notas y archivo.
- Estados: vigente, por vencer, vencido, en renovación, renovado, archivado.
- Avisos configurables (30, 15, 7, 1 y 0 días) por email; WhatsApp oficial posteriormente.
- Vista lista y calendario; filtros por categoría, responsable y estado.
- Versionado de documentos, renovación y auditoría.
- Importación CSV, exportación CSV/Excel y detección asistida de fecha por OCR en fases posteriores.
- MVP de producción: autenticación, organización, adjuntos privados, CRUD, alertas reales, cuotas y reportes.
- Implementado hoy solo en navegador: CRUD de metadatos, estados por fecha, filtros y CSV. Sin alertas reales ni archivos.

## 02 CotizaFollow

Problema: cotizaciones enviadas que nunca reciben seguimiento.

- Contactos, organizaciones y servicios.
- Cotizaciones con ítems, descuentos, impuestos, moneda, plazo, condiciones y PDF.
- Versionado y estados: borrador, enviada, seguimiento, aceptada, rechazada, vencida, cancelada.
- Seguimientos programados por correo con opción de pausar y respetar consentimiento.
- Métricas de monto cotizado, porcentaje aceptado, antigüedad, actividad por vendedor.
- Futuros: aceptar propuesta desde enlace seguro, integración opcional con CobroListo y firma por proveedor autorizado.
- MVP: contactos, cotizaciones, PDF, cambios de estado, recordatorios y panel.

## 03 CobroListo

Problema: cuentas por cobrar y abonos desordenados.

- Clientes, documentos de referencia, monto, fecha de vencimiento, saldo, monedas.
- Pagos parciales, pagos totales, diferencias y comprobantes.
- Estados: pendiente, por vencer, vencida, parcialmente pagada, pagada, anulada y en disputa.
- Recordatorios respetuosos con reglas de frecuencia, pausa por disputa y registro de intentos.
- Aging de saldos; exportación para contabilidad; separación entre facturación y cobros.
- Futuros: enlaces de pago y conciliación con proveedor autorizado.
- MVP: registro, abonos, avisos por correo, reportes y exportación. No sustituye el SII ni contabilidad.

## 04 DocExtract

Problema: transcribir a mano datos de facturas, boletas, órdenes y contratos.

- PDF digital y escaneado; JPG/PNG; lotes.
- Extraer texto nativo antes de recurrir a OCR/IA.
- Esquemas configurables por tipo: emisor, RUT, folio, fechas, neto, IVA, total, ítems.
- Previsualización del documento y edición humana de los campos, sin completar valores inventados.
- Validación de RUT, sumas, fechas y duplicados.
- Exportación Excel/CSV/JSON y API en etapas posteriores.
- Medir páginas y costo real por proveedor; cuotas y límites por plan.
- MVP: carga, extracción, revisión humana, exportación y archivo privado.

## 05 RenuevaPro

Problema: perder renovaciones de contratos comerciales y mantenimiento.

- Registro de servicios contratados: cliente, plan, precio, inicio, término, periodicidad, responsable.
- Renovaciones mensual, trimestral, semestral, anual o personalizada.
- Estados: activo, por renovar, pendiente de respuesta, renovado, suspendido, cancelado.
- Recordatorios internos y externos; historial de renovaciones y motivos de baja.
- MRR contractual estimado diferenciado de facturación y cobro efectivo.
- Futuros: reajuste, aprobación de propuesta, integración con CobroListo.
- MVP: contratos, ciclos, estados, avisos y panel.

## 06 CertiQR

Problema: generación manual y verificación difícil de certificados.

- Plantillas con marca, curso, participante, fecha, duración, ID, firma visual y QR.
- Emisión individual y por lote CSV/Excel; PDF imprimible.
- URL pública verificable con identificadores impredecibles y revelación mínima de datos personales.
- Estados: borrador, emitido, revocado, reemplazado y vencido opcionalmente.
- Reemisión, revocación, historial y control de usuarios.
- Futuros: firma electrónica mediante proveedor, API y webhooks.
- MVP: plantillas, importación, PDF, QR, página de verificación y revocación.

## Integraciones entre productos

- CotizaFollow a CobroListo: propuesta aceptada puede crear cuenta pendiente, previa confirmación.
- CobroListo a RenuevaPro: períodos contratados pueden originar obligaciones de cobro.
- DocExtract a CobroListo: factura verificada puede crear registro financiero.
- DocExtract a VenceYa: documento con fecha verificada puede generar registro de vencimiento.
- RenuevaPro a VenceYa: contrato puede tener controles de documento ligados, sin duplicar datos.

Las integraciones son opt-in, tienen permisos por organización y eventos auditados.
