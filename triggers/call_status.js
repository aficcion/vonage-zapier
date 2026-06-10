'use strict';

const FINAL_STATUSES = ['completed', 'failed', 'busy', 'cancelled', 'unanswered', 'rejected', 'timeout'];

const performList = async (z, bundle) => {
  return [
    {
      uuid: 'aaaaaaaa-bbbb-cccc-dddd-0123456789ab',
      status: 'completed',
      direction: 'outbound',
      from: '15551234567',
      to: '15559876543',
      duration: '30',
      timestamp: new Date().toISOString(),
    },
  ];
};

const { makeAppWebhookHooks, takeOverField } = require('../app_webhooks');

const { subscribeHook, unsubscribeHook } = makeAppWebhookHooks(
  'voice',
  'event_url'
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

const getCallStatus = (z, bundle) => {
  const payload = bundle.cleanedRequest;

  const watchedStatuses = normaliseList(bundle.inputData.statuses, FINAL_STATUSES);

  if (!watchedStatuses.includes(payload.status)) return [];

  return [
    {
      uuid: payload.uuid,
      conversationUuid: payload.conversation_uuid,
      status: payload.status,
      direction: payload.direction,
      from: payload.from,
      to: payload.to,
      startTime: payload.start_time || '',
      endTime: payload.end_time || '',
      duration: payload.duration || '',
      rate: payload.rate || '',
      price: payload.price || '',
      network: payload.network || '',
      timestamp: payload.timestamp || new Date().toISOString(),
    },
  ];
};

module.exports = {
  key: 'call_status',
  noun: 'Call Status',
  display: {
    label: 'Call Status Changed',
    description:
      'Triggers when a Vonage call reaches a selected status (e.g. completed, failed). Turning the Zap on registers the application Event URL automatically (one Zap per application at a time).',
  },
  operation: {
    type: 'hook',
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform: getCallStatus,
    performList,
    inputFields: [
      {
        key: 'statuses',
        label: 'Trigger on Statuses',
        type: 'string',
        required: false,
        list: true,
        choices: [
          'started', 'ringing', 'answered', 'machine', 'completed',
          'busy', 'cancelled', 'failed', 'rejected', 'timeout', 'unanswered',
        ],
        default: 'completed,failed',
        helpText: 'Select which call statuses trigger this Zap. Defaults to final statuses.',
      },
      takeOverField,
    ],
    sample: {
      uuid: 'aaaaaaaa-bbbb-cccc-dddd-0123456789ab',
      status: 'completed',
      direction: 'outbound',
      from: '15551234567',
      to: '15559876543',
      duration: '30',
      timestamp: '2026-01-01T12:00:30Z',
    },
  },
};
