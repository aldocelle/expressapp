# Seguridad y privacidad · Lista de control

**Estado:** documentación para implementación. El frontend actual funciona solo como demo local. No subir documentos sensibles ni información personal real.

Antes de activar usuarios externos:

1. HTTPS y política de cookies/configuraciones de sesión segura.
2. Hash de contraseña robusto; rotación y recuperación seguras; MFA para administración.
3. Autorización en backend por recurso y tenant (organization_id); pruebas IDOR/BOLA.
4. Consultas parametrizadas y validación con esquemas compartidos.
5. Prevención XSS, CSRF según autenticación escogida, abuso de endpoints y mass assignment.
6. Restricciones de concurrencia/idempotencia para cobros, altas y renovaciones.
7. Subida de archivos con validación de tamaño, tipo real, malware, ubicación privada y enlaces temporales.
8. Secretos únicamente en backend, fuera de control de versiones.
9. Límite de páginas OCR, tamaño de lotes, cuotas y presupuesto de API.
10. Trabajos asíncronos con reintentos, deduplicación y registros de entrega.
11. Backup cifrado, restauración verificada y plan de incidentes.
12. Políticas de minimización, conservación, exportación y eliminación de datos.
13. Evaluación actualizada de leyes chilenas de protección de datos, consumidor, tributación y mensajería comercial antes de producción.
14. Avisos y consentimiento para comunicaciones cuando correspondan.
15. Registro de auditoría inmutable para acciones administrativas importantes.

**Limitación presente:** localStorage no proporciona aislamiento de usuarios ni continuidad entre dispositivos; cualquier persona con acceso al mismo perfil del navegador puede consultar los registros. La demo carece de backend y envío de comunicaciones.
