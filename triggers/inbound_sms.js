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

const subscribeHook = async (z, bundle) => {
  // Store the Zapier webhook URL so the user knows where to point Vonage
  return { webhookUrl: bundle.targetUrl };
};

const unsubscribeHook = async (z, bundle) => {
  return {};
};

const getInboundSms = (z, bundle) => {
  const payload = bundle.cleanedRequest;
  return [
    {
      msisdn: payload.msisdn,
      to: payload.to,
      messageId: payload['messageId'] || payload['message-id'],
      text: payload.text,
      type: payload.type || 'text',
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
      'Triggers when a new SMS is received on your Vonage virtual number. Point your Vonage inbound webhook at the URL Zapier provides.',
    directions:
      '1. Enable this trigger to get a Zapier webhook URL.\n2. Go to your [Vonage Dashboard → API Settings](https://dashboard.nexmo.com/settings) and set the **Inbound Messages Webhook URL** to the Zapier webhook URL shown above.\n3. Send a test SMS to your Vonage number to verify.',
  },
  operation: {
    type: 'hook',
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform: getInboundSms,
    performList,
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
