'use strict';

const { makeAppWebhookHooks, takeOverField } = require('../app_webhooks');

const { subscribeHook, unsubscribeHook } = makeAppWebhookHooks(
  'messages',
  'inbound_url'
);

const performList = async (z, bundle) => {
  return [
    {
      messageUuid: 'aaaaaaaa-bbbb-cccc-dddd-0123456789ab',
      from: '15559876543',
      to: 'mybrand',
      channel: 'rcs',
      messageType: 'text',
      text: 'Sample inbound message',
      timestamp: new Date().toISOString(),
    },
  ];
};

const getInboundMessage = (z, bundle) => {
  const payload = bundle.cleanedRequest;

  return [
    {
      messageUuid: payload.message_uuid,
      from: payload.from,
      to: payload.to,
      channel: payload.channel || '',
      messageType: payload.message_type || 'text',
      text: payload.text || '',
      imageUrl: payload.image ? payload.image.url : '',
      audioUrl: payload.audio ? payload.audio.url : '',
      videoUrl: payload.video ? payload.video.url : '',
      fileUrl: payload.file ? payload.file.url : '',
      location: payload.location ? JSON.stringify(payload.location) : '',
      timestamp: payload.timestamp || new Date().toISOString(),
      clientRef: payload.client_ref || '',
      contextMessageUuid:
        payload.context && payload.context.message_uuid
          ? payload.context.message_uuid
          : '',
    },
  ];
};

module.exports = {
  key: 'inbound_message',
  noun: 'Inbound Message',
  display: {
    label: 'New Inbound Message (Multi-Channel)',
    description:
      'Triggers when a message arrives on any Messages API channel (RCS, WhatsApp, MMS, Viber, Messenger, or SMS on numbers linked to your Vonage Application). Turning the Zap on registers the application Inbound URL automatically (one Zap per application at a time).',
  },
  operation: {
    type: 'hook',
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform: getInboundMessage,
    performList,
    inputFields: [takeOverField],
    sample: {
      messageUuid: 'aaaaaaaa-bbbb-cccc-dddd-0123456789ab',
      from: '15559876543',
      to: 'mybrand',
      channel: 'rcs',
      messageType: 'text',
      text: 'Hello!',
      timestamp: '2026-01-01T12:00:00Z',
    },
  },
};
