# Prompt para iniciar la Sesión 1 (copiar y pegar en una sesión nueva)

---

Vamos a ejecutar la **Sesión 1 del Backlog Zapier v1.1** del conector Vonage-Zapier.

**Lee primero, en este orden:**
1. Tu memoria sobre el proyecto (`project_vonage_zapier`) — estado completo.
2. `~/vonage-zapier/docs/PLAN-mejoras-cruzadas.md` — sección "Backlog Zapier v1.1", Sesión 1. Ese es el contrato de hoy.

**Misión (Sesión 1 — la conexión ideal):** cambiar la autenticación del conector de `custom` a **session auth** para que el usuario solo meta API key + secret, y la app de Vonage + el JWT sean invisibles:
- El exchange de session auth hace find-or-create de la app gestionada (nombre "Zapier" — la `f56f9d40-1f1a-4861-822a-c7a3e0f4edbf` ya existe, REUTILÍZALA), genera el par RSA, registra la pública vía Application API (Basic, GET-merge-PUT preservando capabilities) y guarda `{appId, privateKey}` en `sessionData`.
- `jwt_middleware.js` pasa a firmar con lo que llega en `bundle.authData` desde sessionData (mantén el parche "Bearer undefined").
- Auto-curación: afterResponse que ante 401 "Invalid Token" en endpoints JWT lance `z.errors.RefreshAuthError` → Zapier rehace el exchange y reintenta.

**Criterios de aceptación (nada vale sin esto):**
1. Conexión nueva en el editor REAL de Zapier solo con key/secret.
2. Send SMS y Make Call probados E2E en el editor (no curl).
3. Prueba de auto-curación: romper la clave a mano (re-registrar otra pública por API) y ver que el siguiente envío se cura solo.

**Datos operativos:**
- Repo: `~/vonage-zapier` (rama master, sincronizada con GitHub `aficcion/vonage-zapier`).
- Node 22: `export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:$PATH"`. CLI = `zapier-platform` (no `zapier`); deploy key ya en `~/.zapierrc`; subir con `npm run push` o `zapier-platform push` (sobreescribe v1.0.0 en caliente — para esta sesión valora si subir como versión nueva 1.1.0, la migración de auth rompe las conexiones existentes; al ser app privada es aceptable).
- Credenciales Vonage en `~/vonage-zapier/.env`. Número de pruebas: +34622293256 (sin `+` en los campos).
- Probar en el editor real con la extensión de Chrome. OJO: la ventana emergente de conexión NO es accesible para la extensión — los campos los rellena Carlos (tú le preparas valores y portapapeles con `pbcopy`). Con session auth solo serán 2 campos.
- Si el lienzo del editor carga vacío (glitch conocido): duplicar un Zap existente en vez de crear de cero, y clicar por referencias DOM (`find` de la extensión).
- Checklist de regresión: los 5 bugs del 10-jun (ver plan, sección "Mejoras comunes").
- Commits locales con mensajes claros; NO push a GitHub sin OK explícito de Carlos.
- Carlos es PM, no developer: resultados en lenguaje de producto, opciones con recomendación clara, una pregunta cada vez.

Empieza leyendo el plan y `authentication.js`, propón el diseño del exchange en 5 líneas, y a por ello.
