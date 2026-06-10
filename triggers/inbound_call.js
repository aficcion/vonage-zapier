'use strict';

const performList = async (z, bundle) => {
  return [
    {
      uuid: 'aaaaaaaa-bbbb-cccc-dddd-0123456789ab',
      status: 'ringing',
      direction: 'inbound',
      from: '15559876543',
      to: '15551234567',
      timestamp: new Date().toISOString(),
    },
  ];
};

const { makeAppWebhookHooks, takeOverField } = require('../app_webhooks');

const { subscribeHook, unsubscribeHook } = makeAppWebhookHooks(
  'voice',
  'event_url'
);

const getInboundCall = (z, bundle) => {
  const payload = bundle.cleanedRequest;

  // The application's event_url receives every event of every call on this
  // application; this trigger only fires for the first event of an inbound
  // call. Use the Call Status trigger for the full lifecycle.
  if (payload.direction !== 'inbound' || payload.status !== 'ringing') {
    return [];
  }

  return [
    {
      uuid: payload.uuid,
      conversationUuid: payload.conversation_uuid,
      status: payload.status,
      direction: payload.direction || 'inbound',
      from: payload.from,
      to: payload.to,
      timestamp: payload.timestamp || new Date().toISOString(),
      startTime: payload.start_time || '',
      endTime: payload.end_time || '',
      duration: payload.duration || '',
      rate: payload.rate || '',
      price: payload.price || '',
      network: payload.network || '',
    },
  ];
};

module.exports = {
  key: 'inbound_call',
  noun: 'Inbound Call',
  display: {
    label: 'New Inbound Call',
    description:
      'Triggers when an inbound call is received on a number linked to your Vonage Application. Turning the Zap on registers the application Event URL automatically (one Zap per application at a time).',
  },
  operation: {
    type: 'hook',
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform: getInboundCall,
    performList,
    inputFields: [takeOverField],
    sample: {
      uuid: 'aaaaaaaa-bbbb-cccc-dddd-0123456789ab',
      status: 'ringing',
      direction: 'inbound',
      from: '15559876543',
      to: '15551234567',
      timestamp: '2026-01-01T12:00:00Z',
    },
  },
};
