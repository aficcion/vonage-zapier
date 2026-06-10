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

const subscribeHook = async (z, bundle) => {
  return { webhookUrl: bundle.targetUrl };
};

const unsubscribeHook = async (z, bundle) => {
  return {};
};

const getInboundCall = (z, bundle) => {
  const payload = bundle.cleanedRequest;
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
      'Triggers when an inbound call is received on your Vonage virtual number.',
    directions:
      '1. Enable this trigger to get a Zapier webhook URL.\n2. In your [Vonage Application](https://dashboard.nexmo.com/applications), set the **Answer URL** (or **Event URL**) to the Zapier webhook URL.\n3. Call your Vonage number to test.',
  },
  operation: {
    type: 'hook',
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform: getInboundCall,
    performList,
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
