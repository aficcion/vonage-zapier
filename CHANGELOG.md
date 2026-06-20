# Changelog

## 1.5.0

- New action **Send WhatsApp Message** — the full WhatsApp feature set (text, image, audio, video, file, and approved templates) as a named, discoverable action. The channel is fixed to WhatsApp, so there's no channel picker; everything else matches **Send Message**.
- New action **Send RCS Message** — the full RCS feature set (text, image, video, file, rich **card**, and **carousel** with reply / open-URL / dial buttons) as a named, discoverable action. The channel is fixed to RCS.
- New action **API Request** — a raw, authenticated passthrough to any Vonage API endpoint (parity with Twilio's / Telnyx's generic request action). Pick the method, URL and auth scheme (`jwt` for Messages/Voice/Verify, `basic` for account/balance/Number Insight), add optional JSON headers, query parameters and body, and get back `{ status, headers, body }`. A 4xx/5xx is returned (not thrown) so you can inspect the body and branch on the status.
- **Send Message (Multi-Channel)** is unchanged and stays the catch-all: it still covers every channel — including the long-tail ones the named actions don't surface (MMS, Viber, Messenger, Instagram) — plus the complete RCS card/carousel and WhatsApp template feature set. The named WhatsApp/RCS actions are additive and reuse the same Messages API engine.
- Richer output fields and samples on the **New Inbound Message** and **Message Status Updated** triggers (message UUID, from, to, channel, message type, text, status, timestamps, error details) for easier field mapping in later Zap steps.

## 1.4.0

- New **Advanced (bring-your-own-app)** connection mode, for parity with the Power Automate connector. The connection gains two optional fields — **Application ID** and **Private Key**: fill them to send from your own existing Vonage application; leave them blank to keep the default Managed behaviour (the connector provisions and self-heals a `Zapier` application for you). In Advanced mode the connector never creates, modifies or rotates an application or key. A 401 in Advanced mode now reports a clear "check your Application ID / Private Key" error instead of looping the auth refresh.

## 1.3.0

- Removed the two legacy SMS-API triggers — **New Inbound SMS** and **Delivery Receipt Received** — along with the account-settings webhook module that backed them. They duplicated the Messages-API triggers **New Inbound Message** and **Message Status Updated**, which cover inbound messages and delivery/read status across every channel. Existing Zaps that relied on the removed triggers should switch to the Messages-API equivalents.
- "Send SMS" is unaffected: it already sends over the Messages API, not the legacy SMS API.

## 1.2.0

- Verifications started with "Send Verification Code" are now signed with the connector's managed Vonage application, so the "Verify Event (2FA)" trigger receives their events (completed, failed…) with zero configuration. Check and Cancel share the same signature — a Verify v2 request is only visible to the credential that created it.
- Removed the "Event Callback URL" field from Send Verification Code: Verify v2 rejects a per-request callback URL, so the field could never work. Events flow through the application webhook instead (see above).
- New search: **Get Account Balance** — returns the account balance in EUR, with an optional "Low Balance Threshold" input that adds a ready-to-filter Below Threshold flag (Schedule → Get Balance → Filter = low-balance alert, no formulas).
- A 401 when sending on a chat channel (WhatsApp, RCS, Messenger, Viber, Instagram, MMS) now explains that the sender isn't linked to the connector's application and how to fix it, instead of failing with a generic "halted execution" error.
- Verify actions now report API errors in plain language (the raw platform error was shown before).
- Webhook protection ("warn, don't clobber") no longer treats obvious placeholders (example.com, sample NCCOs) as URLs worth protecting.
- Platform: zapier-platform-core upgraded to v19.

## 1.1.0 (updates)

- RCS Rich Card is now sent as a native RBM rich card. The previous simplified format was accepted by the API but always rejected downstream with a generic "internal error" (platform bug); the native format delivers reliably.
- Rich Card buttons: each button now shows only the fields for its chosen type (reply / open URL / dial), and link or phone number are required when the type needs them.
- New RCS message type: **Carousel** — 2 to 10 swipeable cards, each with image, title, description and an optional button (reply / open URL / dial).
- Facebook Messenger validated end-to-end (send + delivery receipts) with the page linked to the connector's managed application.

## 1.1.0

- Connect with only your API key and secret — the Vonage application and JWT signing are now managed automatically by the connector (session auth), and the connection self-heals if its key is rotated externally.
- "From" fields are now dropdowns of your Vonage numbers and registered senders (you can still type a value).
- Send SMS now goes through the Messages API. Send SMS and Send Message can run against the Vonage sandbox for testing.
- New trigger: Delivery Receipt Received (account-level). Triggers that register a Vonage webhook now protect a URL another integration set, unless you opt to take it over, and restore the previous URL when the Zap is turned off.
- Phone numbers are normalized automatically — you can paste them with a leading "+", spaces or dashes and they're cleaned before sending. Alphanumeric sender IDs and emails are left untouched.
- Send Message now shows only the relevant fields: the Message Type list adapts to the chosen channel, and only the content fields for that type appear (e.g. an Image URL for images, the template fields for templates) instead of every field at once.
- RCS Rich Card: a new message type for RCS that sends an image with a title, description and up to 4 tappable buttons in a single card. Each button can be a quick reply, an "open URL" link, or a "dial" call, configured via the "Number of Buttons" selector.

## 1.0.0

Initial private release: SMS, Messages (SMS/RCS/WhatsApp/Viber), Voice calls, Verify (send/check/cancel), Number Insight, and webhook triggers for inbound SMS/messages/calls, call status, message status and Verify events.
