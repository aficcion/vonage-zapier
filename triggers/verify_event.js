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

const subscribeHook = async (z, bundle) => {
  return { webhookUrl: bundle.targetUrl };
};

const unsubscribeHook = async (z, bundle) => {
  return {};
};

const getVerifyEvent = (z, bundle) => {
  const payload = bundle.cleanedRequest;

  const watchedTypes = bundle.inputData.eventTypes || ['completed', 'failed'];

  if (!watchedTypes.includes(payload.type)) return [];

  return [
    {
      requestId: payload.request_id,
      triggeredAt: payload.triggered_at,
      finalisedAt: payload.finalised_at || '',
      type: payload.type,
      channel: payload.channel || '',
      submittedCode: payload.submitted_code || '',
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
      'Triggers when a Vonage Verify v2 workflow emits an event (completed, failed, expired, etc.). Set your Verify callback URL to the Zapier webhook URL.',
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
