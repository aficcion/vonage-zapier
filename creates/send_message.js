'use strict';

// Multi-channel send. The maker picks the channel and message type, then the
// type-specific fields appear. The payload building, dynamic fields and request
// engine all live in ./_channel_send.js, shared with the named single-channel
// actions (send_whatsapp, send_rcs) so there is one Messages API engine.
//
// This action stays the catch-all: it covers every channel — including the
// long-tail ones the named actions don't surface (MMS, Viber, Messenger,
// Instagram) — and the full RCS card/carousel + WhatsApp template feature set.

const {
  sendVia,
  messageTypeField,
  contentFields,
} = require('./_channel_send');

const perform = (z, bundle) => sendVia(z, bundle, bundle.inputData.channel);

module.exports = {
  key: 'send_message',
  noun: 'Message',
  display: {
    label: 'Send Message (Multi-Channel)',
    description:
      'Send a message via SMS, WhatsApp, MMS, Viber, Facebook Messenger, or RCS using the Vonage Messages API.',
  },
  operation: {
    inputFields: [
      {
        key: 'channelHelp',
        type: 'copy',
        helpText:
          'Chat channels need a sender registered on your Vonage account first: ' +
          '[WhatsApp](https://dashboard.nexmo.com/messages/social-channels), ' +
          '[RCS](https://dashboard.nexmo.com/messages/social-channels), ' +
          'Viber & Messenger (sales onboarding), Instagram (early access). ' +
          'SMS works with any of your Vonage numbers. For testing, every chat channel ' +
          'can also run against the [Messages API Sandbox](https://dashboard.nexmo.com/messages/sandbox) with Sandbox Mode on.',
      },
      {
        key: 'channel',
        label: 'Channel',
        type: 'string',
        required: true,
        choices: ['sms', 'whatsapp', 'mms', 'viber_service', 'messenger', 'rcs', 'instagram'],
        altersDynamicFields: true,
      },
      // Message Type — choices depend on the chosen channel.
      messageTypeField,
      {
        key: 'to',
        label: 'To',
        type: 'string',
        required: true,
        helpText: 'Recipient number in E.164 format or platform-specific ID.',
      },
      {
        key: 'from',
        label: 'From',
        type: 'string',
        required: true,
        dynamic: 'list_senders.id.label',
        helpText:
          'Pick a registered sender, or type a Vonage number, WhatsApp Business number, or sender ID.',
      },
      // Content fields — only those tied to the selected message type.
      contentFields,
      {
        key: 'sandbox',
        label: 'Sandbox Mode',
        type: 'boolean',
        required: false,
        default: 'false',
        helpText:
          'Send through the Vonage Messages Sandbox (messages-sandbox.nexmo.com) for testing instead of live delivery.',
      },
    ],
    perform,
    sample: {
      message_uuid: 'aaaaaaaa-bbbb-cccc-dddd-0123456789ab',
      to: '15559876543',
      from: '15551234567',
      channel: 'whatsapp',
    },
    outputFields: [
      { key: 'message_uuid', label: 'Message UUID' },
      { key: 'to', label: 'To' },
      { key: 'from', label: 'From' },
      { key: 'channel', label: 'Channel' },
    ],
  },
};
