'use strict';

// Account-level delivery receipts (DLRs) for numbers not linked to an
// application. Vonage posts these to the single drCallBackUrl on Account
// Settings; turning the Zap on registers Zapier's hook there (warn-don't-
// clobber) and restores the previous URL when the Zap is turned off.
//
// Note: messages sent through an application surface their DLRs via the
// "Message Status Updated" trigger instead (application status_url).

const { makeAccountWebhookHooks, takeOverField } = require('../account_settings');

const { subscribeHook, unsubscribeHook } = makeAccountWebhookHooks(
  'drCallBackUrl',
  'dr-callback-url',
  'delivery receipt'
);

const performList = async (z, bundle) => {
  return [
    {
      messageId: '0A0000000123ABCD1',
      to: '15551234567',
      msisdn: '15559876543',
      status: 'delivered',
      networkCode: '23410',
      price: '0.0333',
      scts: '2601011200',
      timestamp: new Date().toISOString(),
    },
  ];
};

const getDeliveryReceipt = (z, bundle) => {
  // DLRs arrive as GET (query) or POST (body) depending on the account's
  // webhook format — accept both.
  const payload = Object.assign(
    {},
    bundle.cleanedRequest,
    bundle.cleanedRequest.querystring
  );
  return [
    {
      messageId: payload.messageId || payload['message-id'] || payload.message_uuid,
      to: payload.to,
      msisdn: payload.msisdn || payload.from,
      status: payload.status,
      errorCode: payload['err-code'] || payload.error || '',
      networkCode: payload['network-code'] || '',
      price: payload.price || '',
      scts: payload.scts || '',
      clientRef: payload['client-ref'] || payload.client_ref || '',
      timestamp:
        payload['message-timestamp'] || payload.timestamp || new Date().toISOString(),
    },
  ];
};

module.exports = {
  key: 'delivery_receipt',
  noun: 'Delivery Receipt',
  display: {
    label: 'Delivery Receipt Received',
    description:
      'Triggers when Vonage reports a delivery receipt for an SMS sent from a number not linked to an application. Turning the Zap on registers the account delivery-receipt webhook automatically (one Zap at a time). For messages sent through an application, use "Message Status Updated" instead.',
  },
  operation: {
    type: 'hook',
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform: getDeliveryReceipt,
    performList,
    inputFields: [takeOverField],
    sample: {
      messageId: '0A0000000123ABCD1',
      to: '15551234567',
      msisdn: '15559876543',
      status: 'delivered',
      networkCode: '23410',
      price: '0.0333',
      scts: '2601011200',
      timestamp: '2026-01-01T12:00:00Z',
    },
  },
};
