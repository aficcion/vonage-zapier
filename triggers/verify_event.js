'use strict';

const performList = async (z, bundle) => {
  return [
    {
      requestId: 'c11236f4-00bf-4b89-84ba-88b25df97315',
      triggeredAt: new Date().toISOString(),
      type: 'completed',
      channelTimeout: 300,
    },
  ];
};

const { makeAppWebhookHooks, takeOverField } = require('../app_webhooks');
const { verifyWebhookSignature } = require('../verify_webhook');

const { subscribeHook, unsubscribeHook } = makeAppWebhookHooks(
  'verify',
  'status_url'
);

// Zapier list fields can deliver defaults as a single comma-joined item
// (e.g. ['completed,failed']) — split and normalise before matching.
const normaliseList = (value, fallback) => {
  const items = (Array.isArray(value) ? value : [value])
    .filter(Boolean)
    .flatMap((s) => String(s).split(','))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return items.length ? items : fallback;
};

const getVerifyEvent = (z, bundle) => {
  verifyWebhookSignature(z, bundle); // SC-03 (no-op unless a Signature Secret is set)
  const payload = bundle.cleanedRequest;

  const watchedTypes = normaliseList(bundle.inputData.eventTypes, [
    'completed',
    'failed',
  ]);

  // Verify v2 callbacks carry the outcome in `status` ('completed', 'failed',
  // 'expired', ...) while `type` distinguishes the callback kind ('summary' /
  // 'event'). Match on the outcome, falling back to `type` for older shapes.
  const outcome = String(payload.status || payload.type || '').toLowerCase();
  if (!watchedTypes.includes(outcome)) return [];

  // SC-02 — never surface the submitted OTP to the Task History (a one-time
  // code is a sensitive credential). Keep it out of the output entirely; log it
  // only for local debugging.
  if (payload.submitted_code) {
    z.console.log('verify_event submitted_code (debug only, not emitted):', payload.submitted_code);
  }

  return [
    {
      requestId: payload.request_id,
      triggeredAt: payload.triggered_at,
      finalisedAt: payload.finalised_at || '',
      type: payload.type,
      channel: payload.channel || '',
      status: payload.status || '',
      channelTimeout: payload.channel_timeout || '',
      clientRef: payload.client_ref || '',
    },
  ];
};

module.exports = {
  key: 'verify_event',
  noun: 'Verify Event',
  display: {
    label: 'Verify Event (2FA)',
    description:
      'Triggers when a Vonage Verify v2 workflow emits an event (completed, failed, expired, etc.). Turning the Zap on registers the webhook on your Vonage Application automatically. Verifications started with the "Send Verification Code" action emit events here out of the box.',
  },
  operation: {
    type: 'hook',
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform: getVerifyEvent,
    performList,
    inputFields: [
      {
        key: 'eventTypes',
        label: 'Event Types',
        type: 'string',
        required: false,
        list: true,
        choices: ['completed', 'failed', 'expired', 'user-blocked', 'action-pending'],
        default: 'completed,failed',
        helpText: 'Which Verify event types should trigger this Zap.',
      },
      takeOverField,
    ],
    sample: {
      requestId: 'c11236f4-00bf-4b89-84ba-88b25df97315',
      triggeredAt: '2026-01-01T12:00:00Z',
      type: 'completed',
      channel: 'sms',
      status: 'success',
    },
  },
};
