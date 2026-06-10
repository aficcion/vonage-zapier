# Plan de mejoras cruzadas: vonage-zapier ↔ vonage-pa-trigger

**Fecha:** 2026-06-10 · **Owner:** Carlos Bautista (PM conectores, Vonage)
**Repos:** `~/vonage-zapier` (conector Zapier, App241564) · `~/vonage-pa-trigger` (conector PA "Vonage Total" + middleware VCR)

Este doc vive en ambos repos. Es el resultado de comparar los dos proyectos tras
validar el conector Zapier al 100% en el editor real (10-jun-2026, 5 bugs
cazados) y auditar el middleware VCR.

---

## Los dos proyectos en una frase

- **vonage-zapier** — conector puro sin middleware: Zapier hace de gestor de
  suscripciones (REST hooks). Cobertura total (7 acciones, 1 búsqueda, 6
  triggers, todo E2E), pero experiencia JWT manual: el usuario pega una clave
  PEM de 28 líneas en la conexión.
- **vonage-pa-trigger** — cobertura menor (1 trigger, envío multicanal + RCS
  rico, Verify sin cancel), pero con el JWT invisible (`ensure_app_key`:
  genera, registra y rota claves automáticamente) y errores traducidos a
  lenguaje humano (`_verr`).

## Comparativa por dimensión

| Dimensión | Zapier | PA + VCR | Mejor |
|---|---|---|---|
| Experiencia JWT | Usuario pega PEM de 28 líneas | Automático e invisible | **PA** |
| Cobertura de triggers | 6 (inbound SMS cuenta, inbound multicanal, message status, call status, inbound call, verify events) | 1 (mensajes, mezclado con acuses) | **Zapier** |
| Higiene de suscripción | Restaura el webhook anterior al desactivar el Zap | Guarda `prev_inbound`… pero nunca lo restaura | **Zapier** |
| Cobertura de acciones | Voice (Make Call) + Number Insight + Verify completo | RCS rico (card/carrusel/image/video/file) | Empate |
| Mensajes de error | JSON crudo de Vonage | Traducidos y accionables (`_verr`) | **PA** |
| Atribución de producto | Nada | `client_ref` en cada envío | **PA** |
| Verify | send/check/**cancel** (endpoint correcto) | Sin cancel | **Zapier** |
| Multi-app | 1 app por conexión (hoy: 4 conexiones) | App por canal con defaults (`DEFAULT_APPS`) | **PA** |
| Persistencia | N/A (Zapier gestiona) | VCR State provider (Redis) + rotación de claves 90d | **PA** |

## Modelo de usuario: cuándo hace falta una Application (y cuándo no)

La frontera no es intuitiva (herencia histórica de la plataforma). El modelo
explicable tiene TRES niveles:

| Nivel | Identidad | Webhooks | Para quién |
|---|---|---|---|
| **Cuenta** (Dashboard → API Settings) | API key + secret | 2 huecos globales: Inbound SMS + Status/DLR (`moCallBackUrl`/`drCallBackUrl`, y ahí se elige el FORMATO: SMS API clásico vs Messages API) | SMS clásico y números sin app |
| **Aplicación** | Par de claves RSA — **solo UNA clave pública por app** | Por capability: messages inbound/status, voice events, verify status | Messages API (WhatsApp/RCS/MMS/Viber), Voice, y todo recurso vinculado |
| **Recurso** (número / sender WhatsApp / agente RCS) | — | Hereda: vinculado a una app → webhooks de la app; libre → webhooks de cuenta | — |

**Principio (decisión 10-jun): Messages API only.** La SMS API clásica no aporta
nada y Vonage la está deprecando; ambos conectores deben usar la Messages API
para TODO el envío de mensajes (el conector PA ya migró en v2.0.0). Clave que lo
hace indoloro: la Messages API acepta Basic auth — solo exige JWT cuando el
remitente está vinculado a una app. Y los webhooks de CUENTA (API Settings)
sirven para la Messages API: ahí se elige qué API/formato gobierna esos huecos
(la cuenta de Carlos ya está en formato Messages API — es lo que destapó el bug
nº 3). El modelo queda: **una sola API de mensajería, dos niveles de identidad;
el nivel lo decide una pregunta: ¿el remitente está vinculado a una app?**

Reglas y trampas (validadas empíricamente en los PoCs):

- **Una app : N números. Un número : UNA app.** Un sender/agente pertenece a una app.
- **Regla de enrutado**: el tráfico de un recurso va a los webhooks de su app si la tiene; si no, a los de cuenta.
- **Usuario solo-SMS nunca necesita app**: envía (SMS API), recibe (inbound de cuenta) y tiene acuses (status de cuenta).
- **Trampa del vínculo** (hallazgo PoC PA 4-jun): vincular un número/WABA a una app *para recibir* hace que *enviar* desde él pase a EXIGIR JWT — lo que funcionaba con Basic empieza a dar 401.
- **Una clave pública por app = un solo firmante**: dos herramientas no pueden firmar para la misma app sin pisarse la clave (incidente 10-jun: rotar la clave PA-RCS desde Zapier rompió el VCR).
- **Los huecos de cuenta son únicos y globales**: si un conector los toma, se los quita a cualquier otro sistema.

**Implicación de producto**: el usuario no debería entender nada de esto. La app es
detalle de implementación. Recomendaciones de PLATAFORMA para el benchmark:
(a) varias claves públicas por app (o clave de firma a nivel de cuenta) — elimina
las guerras de custodia; (b) una "default application" por cuenta — elimina el
acantilado al pasar de SMS a canales modernos.

## Plan para PA (`vonage-pa-trigger`) ← lo mejor de Zapier

| Pri | Mejora | Detalle |
|---|---|---|
| **P1** | Restaurar webhooks al desuscribir | `DELETE /subscriptions/{id}` solo borra la sub; debe restaurar `prev_inbound` (ya guardado) y el `status_url` previo en la app de Vonage. Patrón: `app_webhooks.js` del repo Zapier (GET-merge-PUT preservando `keys.public_key`). Hoy, al borrar un flujo, Vonage sigue posteando a un `/notify` muerto para siempre. |
| **P1** | Separar trigger de mensajes y de acuses | `/subscribe` apunta `inbound_url` Y `status_url` al mismo `/notify` → el flujo de PA recibe mensajes entrantes y DLRs mezclados. Añadir parámetro `kind` (inbound/status) a `/subscribe` y registrar solo el hook pedido → dos triggers en el conector ("When a message is received" / "When a message status changes"). |
| **P2** | Añadir Cancel Verification | `DELETE /v2/verify/{request_id}` — SIN sufijo `/cancel` (bug nº 5 del conector Zapier, ya pagado). Vía `dynamichosturl` directo a api.nexmo.com como Start/Check. |
| **P2** | Triggers de Voice y Verify events | El gestor de suscripciones ya casi lo soporta: parametrizar capability (`voice.event_url`, `verify.status_url`) como en Zapier. Cuidado: un slot de webhook por app → documentar "un flujo por app y capability". |
| **P3** | Make Call y Number Insight como acciones | Make Call: NCCO inline vía VCR (JWT). Number Insight: directo con Basic (`dynamichosturl`). |

## Plan para Zapier (`vonage-zapier`) ← lo mejor de PA

| Pri | Mejora | Detalle |
|---|---|---|
| **P1** | JWT invisible — con modelo de custodia de 3 niveles | Portar `ensure_app_key` del VCR vía session auth (el usuario mete solo API key/secret; el exchange genera el par RSA, lo registra y guarda el PEM en `sessionData`). PERO la app gestionada solo puede usarse con recursos que el conector pueda poseer: **(1) recurso libre** → vincular a la app gestionada del conector (reversible al desconectar); **(2) recurso vinculado a una app del usuario** → NO tocarlo: detectar el dueño (`app_id` del número / `applications[]` del sender) y dar error útil ("este número pertenece a tu app X — cédela o usa un número gestionado"), nunca el 401 opaco; **(3) cesión opt-in** → el usuario marca "deja que el conector gestione la clave de esta app", con aviso de que cualquier otro firmante de esa app dejará de funcionar (una sola clave pública por app). |
| **P1** | Auto-curación ante clave inválida | Si un envío JWT devuelve 401 "Invalid Token": regenerar+registrar clave y reintentar UNA vez. Resuelve también el conflicto de hoy: la rotación de la clave PA-RCS desde Zapier dejó rota la clave que guarda el VCR (su `/send` RCS está roto ahora mismo; `ensure_app_key` no se auto-cura porque solo regenera si falta o caduca — aplicar la misma auto-curación allí). |
| **P2** | `client_ref: "vonage-zapier"` | En todos los envíos (SMS API y Messages API), sobreescribible por campo opcional. Atribución para métricas de producto. |
| **P2** | Trigger de acuses a nivel CUENTA | Hueco detectado: Message Status solo escucha el nivel app; los DLR de los SMS enviados con Send SMS (API clásica, Basic) caen en el Status webhook de CUENTA (`drCallBackUrl`), hoy sin cubrir. Mismo patrón de auto-suscripción que el inbound SMS de cuenta. Y en ambos huecos de cuenta: si ya hay una URL configurada, AVISAR en vez de pisarla en silencio (son globales y compartidos con otros sistemas del usuario). |
| **P2** | RCS rico (card/carrusel) | Ampliar Send Message con messageType `card`/`carousel` reutilizando los payloads que el conector PA ya manda (los del swagger `/send/card`, `/send/carousel`). |
| **P2** | Messages API only | Send SMS mantiene su UX (from/to/text) pero por debajo pasa de `rest.nexmo.com/sms/json` a `POST /v1/messages` (channel sms) con Basic; si el remitente está vinculado a una app, JWT según el modelo de custodia del P1. Retirar la SMS API clásica del conector. Los triggers de cuenta (inbound + DLR) siguen valiendo: mismos huecos, formato Messages API (ya soportado tras el bug nº 3). |
| **P3** | Errores traducidos | Estilo `_verr`: mapear 401/403 → "revisa credenciales/Application ID", extraer `title`/`detail` del problem+json de Vonage en vez de JSON.stringify crudo. |

## Mejoras comunes

1. **Checklist de QA con los 5 bugs del 10-jun** (ninguno visible en tests unitarios; todos cazados en el diseñador real):
   - JWT firmado DESPUÉS de interpolar la cabecera (middleware tardío → "Bearer undefined").
   - `username`/`password` a nivel de request ignorados por zapier-platform-core (y `auth: [u,p]` documentado como "not implemented") → cabecera Basic a mano.
   - Payloads entrantes en dos formatos (SMS clásico `msisdn`/`message-id` vs Messages API `from`/`message_uuid`) según configuración de cuenta → aceptar ambos.
   - Campos lista de Zapier entregan el default como UN item con comas (`['completed,failed']`) → normalizar (split + lowercase).
   - Cancel Verify: `DELETE /v2/verify/{id}` sin sufijo `/cancel`.
2. **Regionalidad de Verify v2** (documentar en ambos): una verificación creada en una región (p. ej. curl desde EU) NO es visible desde otra (Zapier ejecuta en US → 404 "not found" sobre una request viva). Flujos enteramente dentro del conector funcionan; mezclar orígenes falla de forma engañosa. Existen `api-eu`/`api-us.vonage.com` explícitos.
3. **Un solo dueño de claves por app**: hoy hay claves en `~/vonage-zapier/*.key`, `~/power-automate-vonage-sms/private_*.key` (obsoletas) y en el State del VCR (la de PA-RCS, obsoleta desde la rotación del 10-jun). Decidir el dueño (propuesta: el componente con auto-provisión, es decir VCR para PA y sessionData para Zapier) y limpiar el resto.
4. **Doctrina de pruebas**: nada es válido hasta probarlo en el diseñador real (PA) / editor real (Zapier). Los tests unitarios no ven la serialización ni la plataforma.
5. **Consolidación PA**: "Vonage Total" (este repo) supersede al conector "Vonage SMS" (`~/power-automate-vonage-sms`, v2.1.0). Mantener el viejo solo como referencia del benchmark.

## Backlog Zapier v1.1 — la UX objetivo en 3 sesiones (acordado 10-jun)

**Norte de diseño:** el usuario describe QUÉ comunicar y por dónde; el conector
resuelve solo QUIÉN firma y A DÓNDE llegan los eventos. Conexión = solo API
key + secret. La app es un detalle interno: nace cuando hace falta
(find-or-create "Zapier (managed)"), trabaja en silencio, se cura sola.

### Sesión 1 — La conexión ideal (core) — ✅ HECHA (10-jun-2026)

Validada E2E en el editor real con v1.1.0: conexión nueva solo key/secret,
Send SMS (Basic) y Make Call (JWT invisible) OK, y auto-curación probada
rompiendo la clave a mano (clave intrusa por API → retest → el conector se
recuperó solo y la llamada salió). Pendiente administrativo: aceptar los
Developer ToS de Zapier (zapier.com/app/developer) para poder promocionar
1.1.0, y reconectar los Zaps de demo (siguen en 1.0.0 con conexiones custom).
1. `authentication.js`: de `custom` a **session auth**. Campos: solo apiKey/apiSecret.
   El exchange hace find-or-create de la app gestionada (nombre "Zapier"; la
   `f56f9d40-1f1a-4861-822a-c7a3e0f4edbf` creada el 10-jun ya sirve — REUSAR),
   genera par RSA, registra la pública (Application API, Basic, GET-merge-PUT
   preservando capabilities) y guarda `{appId, privateKey}` en `sessionData`.
2. `jwt_middleware.js`: firmar con `sessionData` (llega en `bundle.authData`).
   Mantener el parche "Bearer undefined".
3. **Auto-curación**: afterResponse → si 401 Invalid Token en endpoint JWT,
   lanzar `z.errors.RefreshAuthError` → Zapier re-ejecuta el exchange
   (regenera+registra clave) y reintenta. Gratis con session auth.
4. Migración: las conexiones custom actuales quedan obsoletas (app privada, OK).
   Recrear conexión y reconectar los Zaps de demo.
   ✅ Criterio: conexión solo con key/secret; Send SMS + Make Call E2E en editor
   real; romper la clave a mano y ver al conector curarse solo.

### Sesión 2 — El envío ideal
1. **Desplegables dinámicos de From**: triggers ocultos que listan números
   (`GET /account/numbers`) y senders (`GET /beta/chatapp-accounts` — beta) por
   canal; `dynamic` en el campo From de cada acción (texto libre como fallback).
2. **Resolución de custodia por envío**: app dueña del From → libre/gestionada:
   firma el conector; app del usuario: error en idioma de producto (cesión
   opt-in = fase posterior).
3. **Messages API only**: send_sms migra a `POST /v1/messages` (misma UX);
   retirar `rest.nexmo.com/sms/json`. `client_ref: "vonage-zapier"` en todo envío.
4. ⚠️ Verificar PRIMERO la incógnita: ¿acepta Messages API el JWT de la app
   gestionada para un remitente NO vinculado? Si no → Basic para libres.

### Sesión 3 — La recepción ideal y los bordes
1. Trigger de **acuses a nivel cuenta** (`drCallBackUrl`).
2. **"Avisar, no pisar"**: si el hueco de webhook está ocupado por URL ajena, el
   trigger falla con explicación + checkbox "tomar el control mientras este Zap
   esté activo".
3. **Empty states guiados** (sin WABA/agente: helpText con enlace al alta) +
   toggle "modo sandbox" en envíos (host messages-sandbox.nexmo.com).
4. Pasada E2E completa (checklist de los 5 bugs como regresión) → **v1.1.0**.

## Orden recomendado

1. Sesión 1 — Zapier P1 (JWT invisible + auto-curación). Máximo impacto para el benchmark: convierte al conector Zapier en la demo definitiva de "así debería ser el conector oficial".
2. Sesión 2 — PA P1 (restaurar webhooks + separar triggers). Arregla el gap más feo del VCR y de paso su clave RCS rota.
3. P2 de ambos según hueco; P3 oportunistas.

## Estado de partida (10-jun-2026)

- Zapier: 100% validado E2E en editor real. 12 commits en GitHub (`aficcion/vonage-zapier`, rama master). App241564 v1.0.0 al día.
- PA: trigger + envío E2E validados el 4-jun sobre VCR (`neru-f1d1ed0b-vonage-pa-middleware-dev.euw1`). `/send` RCS roto desde el 10-jun por rotación de clave (ver P1 auto-curación).
- Secreto API de Vonage pendiente de regenerar (ha circulado por chats); al rotarlo, actualizar 4 conexiones Zapier + conexión PA.
