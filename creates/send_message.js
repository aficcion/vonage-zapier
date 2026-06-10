'use strict';

const { normalizePhone } = require('../phone');

// Chat channels require the sender to be registered (and linked to an
// application) on the Vonage side. SMS does not — the managed JWT signs any
// sender. `isChat` decides whether a sender-not-registered API error gets
// translated into product language.
const CHAT_CHANNELS = ['whatsapp', 'mms', 'viber_service', 'messenger', 'rcs'];

// Channels that accept a caption alongside an image. RCS does not — sending one
// returns 422 "image.caption is not supported for the given channel".
const CAPTION_CHANNELS = ['whatsapp', 'mms', 'messenger', 'viber_service'];

const buildMessagePayload = (inputData) => {
  const { channel, messageType, to, from, text, imageUrl, imageCaption,
    audioUrl, videoUrl, fileUrl, templateName, templateLanguage,
    templateComponents } = inputData;

  const base = {
    channel,
    message_type: messageType,
    to: normalizePhone(to),
    from: normalizePhone(from),
    client_ref: 'vonage-zapier',
  };

  if (messageType === 'text') return { ...base, text };

  if (messageType === 'image') {
    const image = { url: imageUrl };
    // Only attach a caption on channels that support it (RCS rejects it).
    if (imageCaption && CAPTION_CHANNELS.includes(channel)) {
      image.caption = imageCaption;
    }
    return { ...base, image };
  }

  if (messageType === 'audio') return { ...base, audio: { url: audioUrl } };

  if (messageType === 'video') return { ...base, video: { url: videoUrl } };

  if (messageType === 'file') return { ...base, file: { url: fileUrl } };

  if (messageType === 'template') {
    return {
      ...base,
      template: {
        name: templateName,
        language: { code: templateLanguage || 'en_US' },
        components: templateComponents ? JSON.parse(templateComponents) : [],
      },
    };
  }

  return base;
};

const perform = async (z, bundle) => {
  const { channel, from } = bundle.inputData;

  const payload = buildMessagePayload(bundle.inputData);

  // Every channel signs with the managed application JWT (injected by the
  // middleware via the "Bearer undefined" patch).
  const host = bundle.inputData.sandbox
    ? 'messages-sandbox.nexmo.com'
    : 'api.nexmo.com';
  const response = await z.request({
    url: `https://${host}/v1/messages`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${bundle.authData._jwt}`,
    },
    body: payload,
    skipThrowForStatus: true,
  });

  if (response.status >= 400) {
    const err = response.json || {};
    const detail = err.title || err.detail || JSON.stringify(err);

    // On chat channels a 401/403/4xx almost always means the sender isn't
    // registered for that channel on this account. Say so in plain language.
    if (CHAT_CHANNELS.includes(channel)) {
      throw new z.errors.Error(
        `Vonage couldn't send on ${channel} from "${from}". This usually means that sender isn't registered for ${channel} on your Vonage account — pick a registered sender from the dropdown, or set it up in the Vonage dashboard first. (Vonage said: ${detail})`
      );
    }
    throw new z.errors.Error(`Messages API error: ${detail}`);
  }

  return response.json;
};

// --- Dynamic fields ---------------------------------------------------------
// Which message types each channel actually supports.
const TYPES_BY_CHANNEL = {
  sms: ['text'],
  whatsapp: ['text', 'image', 'audio', 'video', 'file', 'template'],
  mms: ['image', 'audio', 'video', 'file'],
  viber_service: ['text', 'image', 'video', 'file'],
  messenger: ['text', 'image', 'audio', 'video', 'file'],
  rcs: ['text', 'image', 'video', 'file'],
};
const ALL_TYPES = ['text', 'image', 'audio', 'video', 'file', 'template'];

// Content fields, one set per message type — only the relevant ones are shown.
const IMAGE_URL_FIELD = { key: 'imageUrl', label: 'Image URL', type: 'string', required: true, helpText: 'Direct URL of the image file (must end in .jpg/.png and return an image, not a web page).' };
const IMAGE_CAPTION_FIELD = { key: 'imageCaption', label: 'Image Caption', type: 'string', required: false };

const CONTENT_FIELDS = {
  text: [
    { key: 'text', label: 'Text', type: 'text', required: true, helpText: 'Message body.' },
  ],
  image: [IMAGE_URL_FIELD, IMAGE_CAPTION_FIELD],
  audio: [
    { key: 'audioUrl', label: 'Audio URL', type: 'string', required: true, helpText: 'Publicly accessible URL of the audio file.' },
  ],
  video: [
    { key: 'videoUrl', label: 'Video URL', type: 'string', required: true, helpText: 'Publicly accessible URL of the video file.' },
  ],
  file: [
    { key: 'fileUrl', label: 'File URL', type: 'string', required: true, helpText: 'Publicly accessible URL of the file.' },
  ],
  template: [
    { key: 'templateName', label: 'Template Name', type: 'string', required: true, helpText: 'WhatsApp approved template name.' },
    { key: 'templateLanguage', label: 'Template Language Code', type: 'string', required: false, default: 'en_US' },
    { key: 'templateComponents', label: 'Template Components (JSON)', type: 'text', required: false, helpText: 'JSON array of WhatsApp template components (header, body, buttons).' },
  ],
};

// Message Type field, with choices limited to what the chosen channel supports.
const messageTypeField = (z, bundle) => {
  const channel = bundle.inputData.channel;
  const choices = TYPES_BY_CHANNEL[channel] || ALL_TYPES;
  return {
    key: 'messageType',
    label: 'Message Type',
    type: 'string',
    required: true,
    choices,
    default: choices[0],
    altersDynamicFields: true,
  };
};

// Only the content fields tied to the selected message type.
const contentFields = (z, bundle) => {
  const channel = bundle.inputData.channel;
  const mt = bundle.inputData.messageType;
  // Fall back to the channel's first/only type so text-only channels (SMS)
  // still show their field before the user touches Message Type.
  const type = mt || (TYPES_BY_CHANNEL[channel] || ALL_TYPES)[0];
  // Image caption only shows on channels that accept it (not RCS).
  if (type === 'image') {
    return CAPTION_CHANNELS.includes(channel)
      ? [IMAGE_URL_FIELD, IMAGE_CAPTION_FIELD]
      : [IMAGE_URL_FIELD];
  }
  return CONTENT_FIELDS[type] || CONTENT_FIELDS.text;
};

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
          'Viber & Messenger (sales onboarding). SMS works with any of your Vonage numbers.',
      },
      {
        key: 'channel',
        label: 'Channel',
        type: 'string',
        required: true,
        choices: ['sms', 'whatsapp', 'mms', 'viber_service', 'messenger', 'rcs'],
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
    },
  },
};
