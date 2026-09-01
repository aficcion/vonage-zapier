# RCS cards and carousels in the Zapier UI

A recurring question about this connector is whether Zapier's step UI can express an RCS rich card or a carousel at all — both are nested structures (a card holds N buttons; a carousel holds N cards, each holding a button), and a Zapier step renders a flat list of scalar inputs with no repeater widget.

It can, and this connector does it today. This document shows the actual step configuration, explains the technique, and points at where it lives. It is a record of what the prototype does — not a prescription for how production should build it.

## What the maker fills in

Both formats are ordinary Zapier form fields. There is no JSON textarea, no Code step, no workaround. The maker picks a number from a dropdown and the step grows the matching fields.

The tables below mirror the two Zaps used to verify this in the Zapier editor against connector v1.7.0, with example values substituted for the real recipient, sender and media URLs. The field names, the structure and the dependencies are exactly as they appear in the step.

The **Shown because** column is the part that matters: it is what a screenshot can't convey.

### Rich card

| Field | Value | Shown because |
|-------|-------|---------------|
| Message Type | `card` | always |
| To | `447700900001` | always |
| From | `acme_support — rcs (Acme Support)` | always |
| Image / Media URL | `https://example.com/media/spring-offer.jpg` | Message Type = `card` |
| Card Title | `Spring offer` | Message Type = `card` |
| Card Description | `Two nights, half price.` | Message Type = `card` |
| Media Height | `MEDIUM` | Message Type = `card` |
| **Number of Buttons** | `3` | Message Type = `card` |
| Button Order | *(blank)* | Message Type = `card` |
| Button 1 — Type | `reply` | Number of Buttons ≥ 1 |
| Button 1 — Text | `Yes` | Number of Buttons ≥ 1 |
| Button 1 — Postback Data | `offer_yes` | Number of Buttons ≥ 1 |
| Button 2 — Type | `open_url` | Number of Buttons ≥ 2 |
| Button 2 — Text | `Open` | Number of Buttons ≥ 2 |
| **Button 2 — Link** | `https://www.vonage.com` | **Button 2 Type = `open_url`** |
| Button 3 — Type | `dial` | Number of Buttons ≥ 3 |
| Button 3 — Text | `Call` | Number of Buttons ≥ 3 |
| **Button 3 — Phone Number** | `+447700900000` | **Button 3 Type = `dial`** |
| Sandbox Mode | `false` | always |

A `reply` button never shows Link or Phone Number. A `dial` button also offers an optional Fallback URL.

### Carousel

The same pattern, one level deeper: **Number of Cards** drives how many card blocks exist, and each card's own button type decides its extra field.

| Field | Value | Shown because |
|-------|-------|---------------|
| Message Type | `carousel` | always |
| Card Width | `MEDIUM` | Message Type = `carousel` |
| Media Height | `MEDIUM` | Message Type = `carousel` |
| **Number of Cards** | `3` | Message Type = `carousel` |
| Card Order | *(blank)* | Message Type = `carousel` |
| Card 1 — Image / Media URL | `https://example.com/media/card-1.jpg` | Number of Cards ≥ 1 |
| Card 1 — Title | `Card 1` | Number of Cards ≥ 1 |
| Card 1 — Button | `reply` | Number of Cards ≥ 1 |
| Card 1 — Button Text | `Reply` | Card 1 Button ≠ `none` |
| Card 2 — Image / Media URL | `https://example.com/media/card-2.jpg` | Number of Cards ≥ 2 |
| Card 2 — Title | `Card 2` | Number of Cards ≥ 2 |
| Card 2 — Button | `open_url` | Number of Cards ≥ 2 |
| Card 2 — Button Text | `Open` | Card 2 Button ≠ `none` |
| **Card 2 — Button Link** | `https://www.vonage.com` | **Card 2 Button = `open_url`** |
| Card 3 — Image / Media URL | `https://example.com/media/card-3.jpg` | Number of Cards ≥ 3 |
| Card 3 — Title | `Card 3` | Number of Cards ≥ 3 |
| Card 3 — Button | `dial` | Number of Cards ≥ 3 |
| Card 3 — Button Text | `Call` | Card 3 Button ≠ `none` |
| **Card 3 — Button Phone Number** | `+447700900000` | **Card 3 Button = `dial`** |
| Sandbox Mode | `false` | always |

## Deleting, reordering and duplicating cards

The per-card fields are keyed by position — `crd2Title` means "the title of whatever sits in slot 2" — so on its own the slot number *is* the card's identity. That makes structural edits destructive: dropping **Number of Cards** from 5 to 4 removes the **last** card, so deleting card 2 would mean retyping cards 3, 4 and 5 by hand, long media URLs included. That is where a maker abandons a 10-card carousel.

**Card Order** (and **Button Order** on a card) separates *where the data lives* from *what gets sent*. It is an optional comma-separated list of slots; blank means the natural `1..N` order.

| To | Set Card Order to |
|----|-------------------|
| Drop card 2 of 5 | `1,3,4,5` |
| Move card 4 to the front | `4,1,2,3,5` |
| Duplicate card 3 | `1,2,3,3,4,5` |

No field is retyped, and the edit is non-destructive: the omitted slot keeps its values, so putting `2` back restores the card.

Two deliberate choices. The field is **not** `altersDynamicFields` — it changes what is sent, never which fields are shown, so it costs no "Refresh fields" round trip. And a slot that is out of range or not a number is an **error**, not a silent drop: a typo must not quietly ship a carousel with a card missing. `parseOrder` in [`creates/_channel_send.js`](../creates/_channel_send.js) raises a message naming the field and the offending value, and the carousel is re-checked against the 2–10 card limit after the list is resolved.

This addresses structural editing only. It gives no preview, no visual grouping of a card's fields, and no inline validation of title or description length — those remain real limits of a flat form.

## How it's built

Four parts, all in [`creates/_channel_send.js`](../creates/_channel_send.js).

**1. Flat keys with the index baked in.** `btn1Text`, `btn2Type`, `crd3MediaUrl`. The nesting is projected onto flat scalar keys so the payload builder can walk `1..N` and find them.

**2. A counter field that re-renders the step.** `altersDynamicFields: true` is what makes Zapier re-request the field list when the value changes:

```js
{ key: 'cardButtonCount', label: 'Number of Buttons', type: 'integer',
  default: '0', choices: ['0','1','2','3','4'],
  altersDynamicFields: true }
```

**3. `inputFields` entries can be functions, not just objects.** A function `(z, bundle) => [...]` receives whatever the maker has typed so far in `bundle.inputData` and returns many fields. `computeContentFields` reads the counter and emits one block per button or card; `buttonFieldsFor(i, type)` and `carouselCardFieldsFor(i, btnType)` generate each block, adding **Link** only for `open_url` and **Phone Number** only for `dial`.

**4. `perform` reassembles the flat keys** back into nested RBM JSON — `buildSuggestions` for card buttons, and the carousel loop in `buildMessagePayload`.

Both formats are sent as `message_type: "custom"` with the native RBM payload, matching Vonage's own [standalone card](https://developer.vonage.com/en/messages/code-snippets/rcs/send-rich-card-standalone) and [carousel](https://developer.vonage.com/en/messages/code-snippets/rcs/send-rich-card-carousel) snippets. Vonage's simplified `message_type: "card"` is **not** used: it is rejected platform-side with a 1030 internal error (verified 2026-06-11).

## Rules that keep the form from breaking

**Never render fields for a state the channel can't produce.** This is the one that actually bit us. In the multi-channel action, toggling Channel and Message Type repeatedly left a stale `messageType` (for example `card` after switching to SMS), the field function returned nothing, and the form went blank — and Zapier's "Refresh fields" did not recover it. `computeContentFields` now validates the stored value against the channel's valid set on every render and falls back to the first valid type. `makeMessageTypeField` does the same for the dropdown's own default, so the control never points at a value it doesn't offer.

**Clamp N identically in the field generator and the payload builder.** If they disagree, lowering the count leaves orphan values that still get sent. Carousel is clamped `2..10` in both places; buttons `≤ 4` in both.

**Mark `required: true` only on fields that are currently rendered.** A required field the generator has hidden blocks the step with no visible cause — which is why Link is marked required inside the `open_url` branch rather than at the top.

**Give every counter a `default`.** Without one the first render shows an empty form and the maker has nothing to act on.

**Nested `altersDynamicFields` propagates slowly, and that is not fixable here.** Changing a button's type doesn't reveal its Link or Phone field until Zapier re-fetches the field list. It is platform behaviour; the connector handles it in `helpText` ("After changing the button type, click Refresh fields to reveal Link/Phone").

## Why the named action is easier than the multi-channel one

`send_rcs` fixes the channel in a closure, so only **one** `altersDynamicFields` field is in play (Message Type). The multi-channel `send_message` has two chained — Channel → Message Type → content — which is exactly where the blank-form failure appeared. If production keeps a multi-channel send, per-channel actions are the safer primary surface, with the unified action as the long-tail fallback.

## Coverage

| What | Where |
|------|-------|
| Payload builders (card, carousel) | [`creates/_channel_send.js`](../creates/_channel_send.js) — `buildMessagePayload`, `buildSuggestions` |
| Dynamic form fields | [`creates/_channel_send.js`](../creates/_channel_send.js) — `computeContentFields`, `buttonFieldsFor`, `carouselCardFieldsFor` |
| The RCS action | [`creates/send_rcs.js`](../creates/send_rcs.js) |
| Unit tests | [`test/creates.test.js`](../test/creates.test.js) — field generation and both payload shapes |

Verified end to end in the Zapier editor: both formats were sent successfully against a live Vonage RCS agent, not only unit-tested. See [handoff-to-engineering.md](handoff-to-engineering.md) for why that distinction matters.

## What this document is not

The connector is a prototype built to find out whether the constraint was real. This is an existence proof and a starting point, not a recommended design — how production builds it is engineering's call.
