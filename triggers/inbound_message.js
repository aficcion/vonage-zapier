'use strict';

const { makeAppWebhookHooks, takeOverField } = require('../app_webhooks');
const { verifyWebhookSignature } = require('../verify_webhook');

const { subscribeHook, unsubscribeHook } = makeAppWebhookHooks(
  'messages',
  'inbound_url'
);

// CM-01 — consent signals. STOP-class keywords opt a recipient OUT; START-class
// opt them back IN. Surfacing isOptOut/isOptIn lets a maker honour consent with
// a simple Filter step instead of parsing the text themselves.
const OPT_OUT_KEYWORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
const OPT_IN_KEYWORDS = ['START', 'UNSTOP', 'YES'];
const keywordOf = (text) => (text || '').trim().toUpperCase();

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
  verifyWebhookSignature(z, bundle); // SC-03 (no-op unless a Signature Secret is set)
  const payload = bundle.cleanedRequest;
  const kw = keywordOf(payload.text);

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
      // CM-01 — consent flags derived from the message text.
      isOptOut: OPT_OUT_KEYWORDS.includes(kw),
      isOptIn: OPT_IN_KEYWORDS.includes(kw),
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
      imageUrl: '',
      audioUrl: '',
      videoUrl: '',
      fileUrl: '',
      location: '',
      timestamp: '2026-01-01T12:00:00Z',
      clientRef: '',
      contextMessageUuid: '',
      isOptOut: false,
      isOptIn: false,
    },
    outputFields: [
      { key: 'messageUuid', label: 'Message UUID' },
      { key: 'from', label: 'From' },
      { key: 'to', label: 'To' },
      { key: 'channel', label: 'Channel' },
      { key: 'messageType', label: 'Message Type' },
      { key: 'text', label: 'Text' },
      { key: 'imageUrl', label: 'Image URL' },
      { key: 'audioUrl', label: 'Audio URL' },
      { key: 'videoUrl', label: 'Video URL' },
      { key: 'fileUrl', label: 'File URL' },
      { key: 'location', label: 'Location (JSON)' },
      { key: 'timestamp', label: 'Timestamp' },
      { key: 'clientRef', label: 'Client Reference' },
      { key: 'contextMessageUuid', label: 'Context Message UUID' },
      { key: 'isOptOut', label: 'Is Opt-Out (STOP keyword)', type: 'boolean' },
      { key: 'isOptIn', label: 'Is Opt-In (START keyword)', type: 'boolean' },
    ],
  },
};
