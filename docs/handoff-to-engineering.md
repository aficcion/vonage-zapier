# Engineering handoff — Vonage connector for Zapier

This document hands a **validated proof of concept** to an engineering team to take to production. It is written so an engineer familiar with Zapier and Vonage can productionize the connector in roughly **two days**. The code in this repo is a reference implementation — the design is the deliverable; treat the code as a working spec to review and own, not as something to merge blindly.

## What this is and its status

A Zapier Platform (CLI) integration for Vonage: send (SMS, WhatsApp, RCS, Viber, MMS, Messenger, Instagram), voice calls, Verify (2FA), Number Insight, balance, and native REST-hook triggers for inbound messages / message status / voice / verify events. Connection is an API key + secret (**Managed** mode — the Vonage Application, its keys and webhooks are provisioned and self-healed automatically), with an optional **Advanced** mode where the maker brings their own Application ID + Private Key. Mirrors the two connection modes of the Power Automate connector.

- **Validated end to end in the real Zapier editor**, not just unit tests (this distinction matters — see Gotchas).
- Runs today as a private app (App241564), version 1.3.0, on `zapier-platform-core` 19.
- 29 unit tests pass; `zapier-platform validate` passes (15 checks, 0 errors).
- Architecture and per-operation behaviour: see [architecture.md](architecture.md) and [reference.md](reference.md).

## What "production-ready" means here

Two separate tracks — do not conflate them:

| Track | Owner | Time |
|-------|-------|------|
| **Productionize the integration** (own the code, harden, set up the production app, pilot) | Engineering | **~2 days (this doc)** |
| **Publish to the public Zapier App Directory** | Zapier review process | Weeks, external — **not in engineering's control** |

The 2-day estimate is for the first track only. If the goal is a publicly listed app, plan the App Directory review as a separate, later milestone.

## Two-day productionization checklist

| # | Task | Est. |
|---|------|------|
| 1 | **Code review & ownership.** Read the 10 small JS files + the two design docs. Confirm you're happy to own them or rewrite from the spec. | 3h |
| 2 | **Production app & account ownership.** Decide which Zapier developer account owns the production app; create/transfer it. (Today it lives under a personal account as App241564.) | 1h |
| 3 | **Harden.** Review error paths and input validation; confirm retry/rate-limit behaviour against Vonage limits. Logic is already there — this is review, not build. | 3h |
| 4 | **Tests & CI.** Run `npx jest` and `zapier-platform validate`; wire both into CI so every push is checked. | 2h |
| 5 | **Security review.** Confirm Zapier encrypts `authData` (the API secret and the generated private key live there). Review the managed-app key model (next section). | 2h |
| 6 | **Managed-app strategy decision.** Settle the one-key-per-app constraint (see Gotchas) before pilot. | 1h |
| 7 | **Private release & E2E smoke.** Release the version privately, connect a real Vonage account, and smoke-test a send + a trigger per channel in the live editor. | 2h |

≈ 2 working days. Adjust task 1 up if rewriting from scratch rather than adopting the code.

## Gotchas already paid for (read before you start — these cost us days)

These were all found in the **real editor**, never in unit tests. They will bite a re-implementation that doesn't know them.

1. **Test in the real editor, always.** Unit tests don't exercise Zapier's request serialization or the platform's auth interpolation. Every bug below was invisible to tests.
2. **JWT must be signed *after* header interpolation.** Zapier interpolates `Bearer ${...}` into the header *before* `beforeRequest` runs, so the first request of an invocation arrives as the literal `"Bearer undefined"`. The middleware patches the header directly (see `jwt_middleware.js`).
3. **`zapier-platform-core` ignores request-level `username`/`password`.** The Basic auth header is built by hand (see `authentication.js` / `app_webhooks.js`). The platform's `auth: [u, p]` shortcut is documented as "not implemented".
4. **Inbound payloads come in two shapes** depending on account config: legacy SMS-API (`msisdn`, `message-id`) vs Messages-API (`from`, `message_uuid`). Triggers accept both.
5. **Zapier list-field defaults arrive as one comma-joined item** (e.g. `['completed,failed']`). Normalise (split + lowercase) before use.
6. **Cancel Verify is `DELETE /v2/verify/{request_id}`** — no `/cancel` suffix (the obvious-looking suffix 404s).
7. **Verify v2 is region-scoped.** A verification created in one region (e.g. EU) is invisible from another (Zapier runs in US → 404 on a live request). Flows entirely inside the connector are fine; mixing origins fails misleadingly. Explicit `api-eu`/`api-us.vonage.com` hosts exist if you need to pin a region.
8. **One public key per Vonage Application = one signer.** The connector manages an app named `Zapier`. If the *same Vonage account* is also used by the Power Automate connector (which manages an app named `Power Automate`), they use different apps and don't collide — but two integrations pointed at the *same* app would overwrite each other's keys (a key war). Keep the managed app dedicated.
9. **Account-level webhook slots are global and shared.** Subscribing protects a foreign URL already in a slot ("warn, don't clobber" + opt-in take-over). Preserve this behaviour.

## The Vonage identity model (essential background)

Vonage has three identity levels; the connector hides them but engineering must understand them:

| Level | Identity | Webhooks | For |
|-------|----------|----------|-----|
| **Account** | API key + secret | Two global slots: inbound SMS + status/DLR | SMS and numbers not linked to an app |
| **Application** | RSA keypair — **one public key per app** | Per capability: messages, voice, verify | Messages API channels, Voice, linked resources |
| **Resource** (number / WhatsApp sender / RCS agent) | — | Inherits: linked to an app → app webhooks; free → account webhooks | — |

Routing rule: a resource's traffic goes to its app's webhooks if it has an app, otherwise to the account webhooks. **The linking trap:** linking a number to an app *to receive* makes *sending* from it require a JWT — what worked with Basic starts returning 401. This connector's design (managed app + self-healing JWT) absorbs that for the user.

## Out of scope for the 2 days

- Public Zapier App Directory listing and its review (separate track, weeks). The known review warnings and their justifications are documented in the internal notes (`notes/promote-review-notes.md`); they are intentional, not bugs.
- New features beyond the current surface.
