'use strict';

// Polling fallback — Vonage SMS API does not expose an inbox list endpoint;
// this stub returns a sample so Zapier can test the trigger.
// Users should configure their Vonage inbound webhook to point at the
// Zapier webhook URL that Zapier provides for this trigger.
const performList = async (z, bundle) => {
  return [
    {
      msisdn: '15559876543',
      to: '15551234567',
      messageId: '0A0000000123ABCD1',
      text: 'Sample inbound SMS from Vonage',
      type: 'text',
      keyword: 'SAMPLE',
      'message-timestamp': new Date().toISOString(),
    },
  ];
};

// The single moCallBackUrl on Account Settings is the registration point for
// inbound SMS on numbers not linked to an application. The shared helper reads
// the slot first (warn-don't-clobber) and restores the previous URL on
// unsubscribe.
const { makeAccountWebhookHooks, takeOverField } = require('../account_settings');

const { subscribeHook, unsubscribeHook } = makeAccountWebhookHooks(
  'moCallBackUrl',
  'mo-callback-url',
  'inbound SMS'
);

const getInboundSms = (z, bundle) => {
  // Vonage may deliver inbound SMS as GET (query params) or POST (body)
  // depending on the account's webhook format setting — accept both.
  const payload = Object.assign(
    {},
    bundle.cleanedRequest,
    bundle.cleanedRequest.querystring
  );
  return [
    {
      // Sender: `msisdn` in classic SMS API format, `from` in Messages API
      // format — which one arrives depends on the account's webhook setting.
      msisdn: payload.msisdn || payload.from,
      to: payload.to,
      messageId: payload['messageId'] || payload['message-id'] || payload.message_uuid,
      text: payload.text,
      type: payload.type || payload.message_type || 'text',
      keyword: payload.keyword || '',
      timestamp: payload['message-timestamp'] || payload.timestamp || new Date().toISOString(),
      networkCode: payload['network-code'] || '',
      price: payload.price || '',
      sessionId: payload['session-id'] || '',
      concat: payload.concat || '',
      concatRef: payload['concat-ref'] || '',
      concatTotal: payload['concat-total'] || '',
      concatPart: payload['concat-part'] || '',
    },
  ];
};

module.exports = {
  key: 'inbound_sms',
  noun: 'Inbound SMS',
  display: {
    label: 'New Inbound SMS',
    description:
      'Triggers when a new SMS is received on your Vonage virtual number. Turning the Zap on registers the webhook in your Vonage account automatically (numbers not linked to a Vonage Application use the account-level inbound URL).',
  },
  operation: {
    type: 'hook',
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform: getInboundSms,
    performList,
    inputFields: [takeOverField],
    sample: {
      msisdn: '15559876543',
      to: '15551234567',
      messageId: '0A0000000123ABCD1',
      text: 'Hello Vonage!',
      type: 'text',
      keyword: 'HELLO',
      timestamp: '2026-01-01T12:00:00Z',
      networkCode: '23410',
    },
  },
};
