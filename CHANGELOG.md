# Changelog

## 1.1.0

- Connect with only your API key and secret — the Vonage application and JWT signing are now managed automatically by the connector (session auth), and the connection self-heals if its key is rotated externally.
- "From" fields are now dropdowns of your Vonage numbers and registered senders (you can still type a value).
- Send SMS now goes through the Messages API. Send SMS and Send Message can run against the Vonage sandbox for testing.
- New trigger: Delivery Receipt Received (account-level). Triggers that register a Vonage webhook now protect a URL another integration set, unless you opt to take it over, and restore the previous URL when the Zap is turned off.

## 1.0.0

Initial private release: SMS, Messages (SMS/RCS/WhatsApp/Viber), Voice calls, Verify (send/check/cancel), Number Insight, and webhook triggers for inbound SMS/messages/calls, call status, message status and Verify events.
