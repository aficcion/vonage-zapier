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

// Vonage has no per-subscription webhook API for account-level inbound SMS;
// the single moCallBackUrl on Account Settings is the registration point.
// Subscribing overwrites it with Zapier's hook URL (and returns the previous
// value so a future enhancement could restore it on unsubscribe).
const setAccountInboundUrl = async (z, bundle, url) => {
  const response = await z.request({
    url: 'https://rest.nexmo.com/account/settings',
    method: 'POST',
    params: {
      api_key: bundle.authData.apiKey,
      api_secret: bundle.authData.apiSecret,
      moCallBackUrl: url,
    },
  });

  if (response.status >= 400) {
    throw new z.errors.Error(
      `Could not update Vonage inbound webhook: HTTP ${response.status}`
    );
  }

  return response.json;
};

const subscribeHook = async (z, bundle) => {
  const settings = await setAccountInboundUrl(z, bundle, bundle.targetUrl);
  return { webhookUrl: bundle.targetUrl, previousUrl: settings['mo-callback-url'] || '' };
};

const unsubscribeHook = async (z, bundle) => {
  await setAccountInboundUrl(z, bundle, '');
  return {};
};

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
