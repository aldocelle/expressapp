# AGENTS.md — instrucciones para agentes de desarrollo en ExpressApps

Lee antes de editar archivos:

- \`docs/GUIA_DISENO.md\`: identidad visual y experiencia de usuario **obligatorias**.
- \`docs/PRODUCTOS.md\`: alcance funcional, implementación por producto.
- \`docs/ARQUITECTURA.md\`: arquitectura evolutiva y seguridad.
- \`docs/ROADMAP.md\`: fases, estado y criterios de aceptación.

## Reglas de diseño

- Conserva el carácter visual actual: editorial/utilitario/cálido, forest green, lime, superficies marfil, Manrope y DM Sans.
- No rehagas el layout de ExpressApps al agregar una nueva app. Comparte sidebar, encabezado, espaciado, botones, estados y patrones de navegación.
- Diferencia las microapps con su acento y gesto funcional propio (ver guía); nunca añadas decoración genérica por rellenar.
- Prioriza jerarquía, legibilidad y accesibilidad WCAG 2.2 AA. Revisa metadatos demasiado pequeños.
- Diseña estados vacío/carga/error/sin permisos/sin cuota, vista móvil y navegación por teclado.
- Las interfaces financieras, documentales o de certificación deben comunicar precisión y confianza, no espectacularidad.
- No uses contenidos falsos para simular métricas, usuarios o funcionalidades reales.

## Reglas de implementación

- Stack actual: Vue 3 + TypeScript + Vite. Respeta la configuración presente; no agregues paquetes sin justificar.
- El núcleo inicial es un frontend local y VenceYa usa localStorage. No presentarlo como producción ni almacenar datos sensibles.
- Las siguientes apps se añaden como módulos coherentes; no se debe duplicar una capa de usuarios, pagos o notificaciones por app.
- Nunca afirmar que un flujo está implementado si no es funcional de extremo a extremo.
- Asegura validación de entradas, tipos, estados de error, pruebas y documentación.
- Para backend futuro: controles de autorización por organización, almacenamiento seguro y APIs oficiales.
- No alterar \`main\` directamente. Trabajar sobre \`develop/microapps\` o ramas derivadas y abrir PR después de verificar.

## Flujo mínimo de trabajo

1. Identifica una sola funcionalidad con valor.
2. Revisa alcance, guía visual y código existente.
3. Diseña flujo y datos; evita nuevas capas si no son necesarias.
4. Implementa función real más experiencia completa.
5. Ejecuta \`npm run typecheck\`, \`npm run test\` y \`npm run build\`.
6. Documenta exactamente qué quedó hecho y qué sigue pendiente.

**Meta:** microaplicaciones pequeñas, útiles, visualmente memorables y preparadas para convertirse en productos SaaS comerciales sin deuda engañosa.
