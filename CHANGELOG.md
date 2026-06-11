# Changelog

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
