'use strict';

const CHANNEL_CONFIGS = {
  sms: { requiresApp: false },
  whatsapp: { requiresApp: true },
  mms: { requiresApp: true },
  viber_service: { requiresApp: true },
  messenger: { requiresApp: true },
  rcs: { requiresApp: true },
};

const buildMessagePayload = (inputData) => {
  const { channel, messageType, to, from, text, imageUrl, imageCaption,
    audioUrl, videoUrl, fileUrl, templateName, templateLanguage,
    templateComponents } = inputData;

  const base = { channel, message_type: messageType, to, from };

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
  const { channel } = bundle.inputData;
  const config = CHANNEL_CONFIGS[channel] || {};

  if (config.requiresApp && (!bundle.authData.applicationId || !bundle.authData.privateKey)) {
    throw new z.errors.Error(
      `The ${channel} channel requires an Application ID and Private Key in your Vonage connection.`
    );
  }

  const payload = buildMessagePayload(bundle.inputData);

  const headers = {};
  if (config.requiresApp) {
    // JWT auth for application-based channels
    const jwt = z.dehydrateFile; // handled by Zapier's auth layer via middleware
    headers['Authorization'] = `Bearer ${bundle.authData._jwt}`;
  }

  const response = await z.request({
    url: 'https://api.nexmo.com/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      Authorization: config.requiresApp
        ? `Bearer ${bundle.authData._jwt}`
        : `Basic ${Buffer.from(
            `${bundle.authData.apiKey}:${bundle.authData.apiSecret}`
          ).toString('base64')}`,
    },
    body: payload,
  });

  if (response.status >= 400) {
    const err = response.json;
    throw new z.errors.Error(
      `Messages API error: ${err.title || err.detail || JSON.stringify(err)}`
    );
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
        helpText: 'Your Vonage number, WhatsApp Business number, or sender ID.',
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
