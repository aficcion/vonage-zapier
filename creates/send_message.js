'use strict';

// Chat channels require the sender to be registered (and linked to an
// application) on the Vonage side. SMS does not — the managed JWT signs any
// sender. `isChat` decides whether a sender-not-registered API error gets
// translated into product language.
const CHAT_CHANNELS = ['whatsapp', 'mms', 'viber_service', 'messenger', 'rcs'];

const buildMessagePayload = (inputData) => {
  const { channel, messageType, to, from, text, imageUrl, imageCaption,
    audioUrl, videoUrl, fileUrl, templateName, templateLanguage,
    templateComponents } = inputData;

  const base = {
    channel,
    message_type: messageType,
    to,
    from,
    client_ref: 'vonage-zapier',
  };

  if (messageType === 'text') return { ...base, text };

  if (messageType === 'image') {
    return { ...base, image: { url: imageUrl, caption: imageCaption || undefined } };
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
  const response = await z.request({
    url: 'https://api.nexmo.com/v1/messages',
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
        key: 'channel',
        label: 'Channel',
        type: 'string',
        required: true,
        choices: ['sms', 'whatsapp', 'mms', 'viber_service', 'messenger', 'rcs'],
        altersDynamicFields: true,
      },
      {
        key: 'messageType',
        label: 'Message Type',
        type: 'string',
        required: true,
        choices: ['text', 'image', 'audio', 'video', 'file', 'template'],
        altersDynamicFields: true,
        default: 'text',
      },
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
      // Text
      {
        key: 'text',
        label: 'Text',
        type: 'text',
        required: false,
        helpText: 'Message body. Required when Message Type is "text".',
      },
      // Image
      {
        key: 'imageUrl',
        label: 'Image URL',
        type: 'string',
        required: false,
        helpText: 'Publicly accessible URL of the image. Required for "image" type.',
      },
      {
        key: 'imageCaption',
        label: 'Image Caption',
        type: 'string',
        required: false,
      },
      // Audio
      {
        key: 'audioUrl',
        label: 'Audio URL',
        type: 'string',
        required: false,
        helpText: 'Publicly accessible URL of the audio file. Required for "audio" type.',
      },
      // Video
      {
        key: 'videoUrl',
        label: 'Video URL',
        type: 'string',
        required: false,
        helpText: 'Publicly accessible URL of the video file. Required for "video" type.',
      },
      // File
      {
        key: 'fileUrl',
        label: 'File URL',
        type: 'string',
        required: false,
        helpText: 'Publicly accessible URL of the file. Required for "file" type.',
      },
      // Template
      {
        key: 'templateName',
        label: 'Template Name',
        type: 'string',
        required: false,
        helpText: 'WhatsApp approved template name.',
      },
      {
        key: 'templateLanguage',
        label: 'Template Language Code',
        type: 'string',
        required: false,
        default: 'en_US',
      },
      {
        key: 'templateComponents',
        label: 'Template Components (JSON)',
        type: 'text',
        required: false,
        helpText: 'JSON array of WhatsApp template components (header, body, buttons).',
      },
    ],
    perform,
    sample: {
      message_uuid: 'aaaaaaaa-bbbb-cccc-dddd-0123456789ab',
    },
  },
};
