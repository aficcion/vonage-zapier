'use strict';

const performList = async (z, bundle) => {
  return [
    {
      messageUuid: 'aaaaaaaa-bbbb-cccc-dddd-0123456789ab',
      to: '15559876543',
      from: '15551234567',
      channel: 'sms',
      status: 'delivered',
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

const getMessageStatus = (z, bundle) => {
  const payload = bundle.cleanedRequest;

  const watchedStatuses = bundle.inputData.statuses || ['delivered', 'failed', 'rejected'];

  if (!watchedStatuses.includes(payload.status)) return [];

  return [
    {
      messageUuid: payload.message_uuid,
      to: payload.to,
      from: payload.from,
      channel: payload.channel,
      status: payload.status,
      timestamp: payload.timestamp || new Date().toISOString(),
      errorCode: payload.error ? payload.error.code : '',
      errorReason: payload.error ? payload.error.reason : '',
      usage: payload.usage || {},
      clientRef: payload.client_ref || '',
    },
  ];
};

module.exports = {
  key: 'message_status',
  noun: 'Message Status',
  display: {
    label: 'Message Status Updated',
    description:
      'Triggers when a Vonage Messages API message reaches a selected status (delivered, failed, etc.). Set your Vonage Application Status URL to the Zapier webhook URL.',
  },
  operation: {
    type: 'hook',
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform: getMessageStatus,
    performList,
    inputFields: [
      {
        key: 'statuses',
        label: 'Trigger on Statuses',
        type: 'string',
        required: false,
        list: true,
        choices: ['submitted', 'delivered', 'read', 'rejected', 'undeliverable', 'failed'],
        default: 'delivered,failed',
        helpText: 'Select which message statuses trigger this Zap.',
      },
    ],
    sample: {
      messageUuid: 'aaaaaaaa-bbbb-cccc-dddd-0123456789ab',
      to: '15559876543',
      from: '15551234567',
      channel: 'sms',
      status: 'delivered',
      timestamp: '2026-01-01T12:00:00Z',
    },
  },
};
