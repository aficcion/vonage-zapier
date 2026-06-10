# Conector Vonage para Zapier — Demo v1.1

Guion de demostración del conector Vonage en Zapier (app privada **App241564**,
versión **1.1.0**). Pensado para enseñar "así debería ser el conector oficial":
el usuario describe **qué** comunicar y **por dónde**; el conector resuelve solo
**quién firma** y **a dónde** llegan los eventos.

> Todo lo que aparece aquí está validado de extremo a extremo en el editor real
> de Zapier (no en simulaciones). Número de pruebas: `+34622293256`.

---

## En 30 segundos

Un único conector que cubre el ciclo completo de comunicaciones de Vonage —
enviar y recibir SMS, mensajes multicanal (WhatsApp, RCS, Viber, Messenger),
llamadas de voz, verificación 2FA y Number Insight — con una conexión que pide
**solo API key + secret**. Todo lo demás (la aplicación de Vonage, la firma con
JWT, el registro de webhooks) es invisible y automático.

---

## Pilar 1 — La conexión ideal

**Antes:** el usuario tenía que crear una aplicación en el panel de Vonage,
generar un par de claves, copiar el Application ID y pegar la clave privada —
cuatro campos y varios pasos fuera de Zapier.

**Ahora:** dos campos.

| Campo | |
|---|---|
| API Key | `f1d1ed0b` |
| API Secret | (oculto) |

Al conectar, el conector (autenticación de sesión) hace en silencio:
1. Busca —o crea— la aplicación gestionada "Zapier" en la cuenta.
2. Genera un par de claves RSA nuevo.
3. Registra la clave pública en la aplicación (preservando sus capacidades y
   webhooks).
4. Guarda `{appId, privateKey}` en la sesión; el middleware firma desde ahí.

**Auto-curación:** si la clave se rota o se rompe por fuera, el siguiente envío
recibe un `401`, el conector relanza el intercambio de sesión (registra una
clave nueva) y reintenta — sin que el usuario haga nada. Validado rompiendo la
clave a mano por API y viendo al conector recuperarse solo.

---

## Pilar 2 — El envío ideal

![Demo: desplegable de From y envío por la Messages API](demo/send-sms-messages-api.gif)

Lo que muestra el GIF (paso "Send SMS" de un Zap):

1. **El campo "From" es un desplegable** que lista los números reales de la
   cuenta de Vonage (`447418348162 — GB (VOICE/SMS)`, etc.), poblado
   automáticamente. El usuario elige de una lista en vez de teclear de memoria;
   también puede escribir un valor a mano (un número o un remitente
   alfanumérico tipo `MyBrand`).
2. **El envío va por la Messages API** (la vía que Vonage recomienda). La salida
   es un `Message Uuid` — la huella de la Messages API — devuelto en segundos.

Puntos finos de producto detrás de esto:
- **Sin fricción de "custodia" para SMS y voz.** Se validó que el JWT de la
  aplicación gestionada firma SMS desde cualquier remitente (un número propio,
  uno libre o un alfanumérico). El usuario nunca topa con un error de "ese
  número no es tuyo".
- **Canales de chat** (WhatsApp/RCS/Viber/Messenger): el remitente sí debe estar
  dado de alta en Vonage. Si no lo está, el conector lo explica en lenguaje
  claro y enlaza al alta, en vez de mostrar un error técnico.
- **`client_ref: "vonage-zapier"`** viaja en todos los envíos, para trazar el
  tráfico del conector.

---

## Pilar 3 — La recepción ideal y los bordes

**Triggers (disparadores) listos para usar**, que registran su webhook en
Vonage automáticamente al encender el Zap:

| Trigger | Qué detecta |
|---|---|
| New Inbound SMS | SMS entrante a tus números |
| New Inbound Message | Mensaje entrante multicanal (RCS, WhatsApp…) |
| New Inbound Call | Llamada entrante |
| Call Status Changed | Estado de llamada (completed, failed…) |
| Message Status Updated | Acuse de mensaje (delivered, read…) |
| Verify Event (2FA) | Evento de verificación |
| **Delivery Receipt Received** *(nuevo)* | Acuse de entrega a nivel cuenta |

Dos comportamientos que protegen al usuario:
- **"Avisar, no pisar":** si activas un Zap cuyo hueco de webhook ya está ocupado
  por otra integración, el conector **se niega a sobrescribirlo** y lo explica,
  con una casilla *"Take over the webhook"* para forzarlo a conciencia. Al
  apagar el Zap, **restaura la URL anterior**.
- **Modo sandbox:** un interruptor en Send SMS y Send Message envía contra el
  entorno de pruebas de Vonage (`messages-sandbox.nexmo.com`) sin entrega real.

---

## Catálogo completo

**Acciones:** Send SMS · Send Message (multicanal) · Make Outbound Call ·
Send Verification Code (2FA) · Check Verification Code · Cancel Verification Request
**Búsquedas:** Number Insight
**Triggers:** los 7 de la tabla anterior + dos desplegables internos
(números y remitentes) que alimentan los campos "From".

---

## Cómo reproducir la demo en vivo (guion)

1. **Conexión** — En un Zap nuevo, elige la app **Vonage (1.1.0)** y conecta una
   cuenta: solo API Key + Secret. (La ventana de conexión se rellena a mano.)
2. **Envío** — Añade el paso **Send SMS**. En "From", abre el desplegable y elige
   un número; en "To" pon `34622293256`; escribe un texto. Pulsa **Test** →
   llega el SMS y devuelve un `Message Uuid`. *(Esto es lo que recoge el GIF.)*
3. **Voz** — Añade **Make Outbound Call** con TTS en `es-ES`; suena el teléfono.
4. **Recepción** — Añade un trigger (p. ej. **Delivery Receipt Received** o
   **Message Status Updated**) y enciéndelo: el webhook se registra solo.
5. **Auto-curación (opcional)** — Rota la clave de la app por fuera y vuelve a
   lanzar un envío: el conector se recupera sin intervención.

---

## Estado

- **v1.1.0** subida a Zapier; código en GitHub (`aficcion/vonage-zapier`, master).
- 16 pruebas en verde · validación de Zapier limpia · regresión de los 5 bugs
  del 10-jun, sana.
- Backlog v1.1 completo (3 sesiones: conexión, envío, recepción).
- App privada: en el editor se elige "Vonage (1.1.0)" directamente. La
  promoción al directorio público de Zapier no es necesaria para uso interno.
