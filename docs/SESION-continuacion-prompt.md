# Prompt de arranque — continuar el conector Vonage-Zapier

Retomamos el conector de Vonage para Zapier (`~/vonage-zapier`, rama master).

**Lee primero, en este orden:** (1) tu memoria del proyecto `[[project-vonage-zapier]]`;
(2) `~/vonage-zapier/CHANGELOG.md` (qué hay en v1.1.0); (3) `~/vonage-zapier/docs/DEMO.md`.

## Estado (10-jun-2026, noche)
- Conector **v1.1.0** subido a Zapier (app privada **App241564**), conexión
  **session auth** ("Vonage (f1d1ed0b)"): el usuario solo mete API key + secret;
  la app gestionada (`f56f9d40…`) y el JWT son invisibles, con auto-curación ante 401.
- Backlog v1.1 (3 sesiones) **completo**: conexión ideal, envío ideal (From con
  desplegables, Messages API), recepción (acuses a nivel cuenta, avisar-no-pisar,
  sandbox). Regresión de los 5 bugs del 10-jun: sana.
- **Mejoras recientes de UX** (todas en v1.1.0): normalización de números
  (`phone.js`), campos dinámicos en Send Message (channel→message type→campos),
  fix del caption en RCS, y **RCS Rich Card** (imagen + título + texto + hasta 4
  botones reply/open_url/dial; botones vía selector "Number of Buttons").
- **6 Zaps de demo** creados en la cuenta ("Vonage Demo — …"): Send SMS, Send RCS,
  Make Voice Call, **Inbound RCS auto-reply (ENCENDIDO)**, Verify 2FA, Send WhatsApp
  (Sandbox). Los de envío en borrador; el inbound encendido.
- **Demo**: `docs/DEMO.md` (inglés) + GIFs + vídeo narrado en `docs/demo/`
  (la media está en `.gitignore` para no inflar el build de Zapier).

## Pendiente
- **GitHub**: hay una tanda de commits locales SIN subir (normalización, campos
  dinámicos, fix caption, rich card, botones). Push solo con OK explícito de Carlos.
- **WhatsApp Sandbox**: el Zap está montado pero el móvil de pruebas
  `+34622293256` debe completar el alta del sandbox (enviar `join <palabra>` por
  WhatsApp al `+14157386102`; la palabra está en el dashboard → Messages → Sandbox).
  El conector y el payload están bien (202); solo falta el whitelisting del móvil.
- **Verificar en el editor real** que los botones dinámicos de la Rich Card
  aparecen al subir "Number of Buttons" (Carlos lo estaba comprobando).

## Operativa
- Repo `~/vonage-zapier` (master). Node 22: `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`.
- CLI: `zapier-platform` (NO `zapier`). `npm test`, `npm run validate`,
  `zapier-platform push`. Creds en `.env` (API key `f1d1ed0b`).
- Móvil de pruebas: `34622293256` (en el conector **sin** `+`).
- Verificar siempre por API (JWT gestionado) antes de montar en UI; el editor de
  Zapier es frágil (canvas glitchea, dropdowns solapan, usar `find` por DOM y duplicar Zaps).
- Commits locales siempre; push a GitHub solo con OK. Carlos es **PM**: lenguaje
  de producto, recomendación clara, una pregunta cada vez, sin verborrea.

Arranca leyendo memoria + CHANGELOG, dime el estado en 5 líneas y a por lo que toque.
