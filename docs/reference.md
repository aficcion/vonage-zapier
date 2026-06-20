# Reference

Every trigger, action and search the connector exposes. All operations authenticate from the connection's API key/secret: account-level reads use Basic auth, while Messages/Voice/Verify use the JWT minted by the connector (see [architecture.md](architecture.md)).

## Triggers

REST-hook triggers subscribe a webhook when a Zap is turned on and unsubscribe when it is turned off. The maker never handles a callback URL. Each hook trigger offers a **"Take over the webhook"** toggle to opt into replacing a URL another integration set.

| Trigger | key | Fires on | Webhook slot |
|---------|-----|----------|--------------|
| **New Inbound Message (Multi-Channel)** | `inbound_message` | Inbound message on the Messages API (any channel) | Application `messages.inbound_url` |
| **Message Status Updated** | `message_status` | Delivery/read status of an outbound Messages-API message | Application `messages.status_url` |
| **New Inbound Call** | `inbound_call` | Incoming voice call | Application `voice.event_url` |
| **Call Status Changed** | `call_status` | Voice call status change | Application `voice.event_url` |
| **Verify Event (2FA)** | `verify_event` | Verify workflow event (completed/failed/expired) | Application `verify.status_url` |

> Inbound and delivery-receipt events are covered by **New Inbound Message** and **Message Status Updated** (Messages API). The legacy SMS-API account-level triggers (`inbound_sms`, `delivery_receipt`) have been removed as duplicates.

### Dynamic dropdowns (internal)

`list_numbers` ("List Vonage Numbers") and `list_senders` ("List Vonage Senders") are not user-facing triggers; they populate the **From** dropdowns in the send actions with the account's real phone numbers and chat-app senders.

> **One Zap per webhook slot.** `inbound_call` and `call_status` share the single `voice.event_url`; likewise each Application slot has one address. The most recently enabled Zap on a slot wins.

## Actions

### Messaging

| Action | key | What it does |
|--------|-----|--------------|
| **Send SMS** | `send_sms` | Send a plain SMS — the simplest send path. |
| **Send WhatsApp Message** | `send_whatsapp` | Send a WhatsApp message — text, image, audio, video, file, or an approved template. Same engine as Send Message, with the channel fixed to WhatsApp for discoverability. |
| **Send RCS Message** | `send_rcs` | Send an RCS message — text, image, video, file, rich **card**, or **carousel** (with reply / open-URL / dial buttons). Channel fixed to RCS. |
| **Send Message (Multi-Channel)** | `send_message` | The catch-all send: pick a channel and message type, then fill the type-specific fields. Covers every channel — including MMS, Viber, Messenger and Instagram, which the named actions don't surface — plus text, media (image/audio/video/file), WhatsApp templates, and RCS Rich Cards / carousels. |
| **Make Outbound Call** | `make_call` | Place a Voice API call (text-to-speech NCCO). |

The named **Send WhatsApp** / **Send RCS** actions and the multi-channel **Send Message** share one Messages API engine ([`creates/_channel_send.js`](../creates/_channel_send.js)); the named actions are exactly Send Message with the channel pinned, nothing removed.

Supported channel → message-type combinations for **Send Message** (and, fixed to one row, the named actions):

| Channel | Message types |
|---------|---------------|
| `sms` | text |
| `whatsapp` | text, image, audio, video, file, template |
| `mms` | image, audio, video, file |
| `viber_service` | text, image, video, file |
| `messenger` | text, image, audio, video, file |
| `instagram` | text, image, audio, video, file |
| `rcs` | text, image, video, file, card, carousel |

Phone numbers are normalised to E.164 without `+` (alphanumeric sender IDs and RCS agent IDs are preserved). RCS Rich Card / carousel buttons support reply, open-URL and dial actions; a dial button's phone number keeps its leading `+`.

### Verify (2FA)

| Action | key | What it does |
|--------|-----|--------------|
| **Send Verification Code (2FA)** | `send_verify` | Start a Verify v2 workflow (default channel SMS). Returns a `request_id`. Signed with the Application JWT so its events reach the `verify_event` trigger. |
| **Check Verification Code** | `check_verify` | Check a PIN against a `request_id`. |
| **Cancel Verification Request** | `cancel_verify` | Cancel an in-flight verification. |

### Advanced

| Action | key | What it does |
|--------|-----|--------------|
| **API Request** | `api_request` | Raw authenticated passthrough to any Vonage endpoint. Choose **Method**, **URL** and **Authentication** (`jwt` = managed application Bearer token for Messages/Voice/Verify/Applications; `basic` = API key/secret for account, balance, Number Insight and legacy REST), plus optional JSON **Headers**, **Query Parameters** and **Body**. Returns `{ status, headers, body }`; a 4xx/5xx is returned, not thrown, so you can inspect the body and branch on the status. The escape hatch for endpoints the connector doesn't model as a first-class action. |

## Searches

| Search | key | What it does |
|--------|-----|--------------|
| **Number Insight Lookup** | `number_insight` | basic/standard/advanced lookup: country, carrier, network type, validity, reachability, ported status, caller name/type. |
| **Get Account Balance** | `get_balance` | Account balance and currency. |

## Authentication summary

Zapier session auth, in two modes:

- **Managed (default)** — the maker enters only **API Key** and **API Secret**. Connecting provisions a managed Vonage Application named `Zapier` and stores `{ applicationId, privateKey }` as session data; the maker never sees them.
- **Advanced (bring-your-own-app)** — the maker also fills the optional **Application ID** and **Private Key** fields, and the connector sends from that application without creating or rotating anything.

See [architecture.md](architecture.md) for the full lifecycle and the design notes.
