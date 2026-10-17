# Instrucciones de GitHub Copilot — ExpressApps

Antes de modificar cualquier pantalla o implementar una microapp, lee y aplica:

1. \`AGENTS.md\`
2. \`docs/GUIA_DISENO.md\`
3. \`docs/PRODUCTOS.md\`
4. \`docs/ARQUITECTURA.md\`
5. \`docs/ROADMAP.md\`

Mantén la identidad editorial/utilitaria/cálida del frontend existente en Vue 3 + TypeScript + Vite. Usa Manrope, DM Sans, la paleta forest/lime y los acentos propios de cada aplicación; aprovecha componentes compartidos, diseño responsive y accesibilidad.

No sustituyas funcionalidades existentes por demos. No agregues métricas ni datos falsos y no presentes características planificadas como disponibles. Incluye estados de carga, vacío, error y permisos según el flujo.

Implementa primero una tarea concreta completamente; ejecuta typecheck, pruebas y build antes de declararla terminada. Si no puedes ejecutar un comando, informa el bloqueo y no inventes resultados.

Trabaja en \`develop/microapps\` o en una rama derivada. Mantén \`main\` estable.
