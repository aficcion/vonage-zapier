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
    templateComponents, cardMediaUrl, cardTitle, cardText,
    cardMediaHeight } = inputData;

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

  if (messageType === 'card') {
    const card = {
      media_url: cardMediaUrl,
      media_height: cardMediaHeight || 'MEDIUM',
    };
    if (cardTitle) card.title = cardTitle;
    if (cardText) card.text = cardText;
    const suggestions = buildSuggestions(inputData);
    if (suggestions.length) card.suggestions = suggestions;
    return { ...base, card, rcs: { card_orientation: 'VERTICAL' } };
  }

  return base;
};

// Build RCS suggestion chips from the flat per-button fields (btn1*..btn4*),
// up to the chosen Number of Buttons. reply -> {type,text,postback_data};
// open_url adds url/description; dial adds phone_number (keeps its +) and an
// optional fallback_url.
const buildSuggestions = (inputData) => {
  const count = parseInt(inputData.cardButtonCount, 10) || 0;
  const chips = [];
  for (let i = 1; i <= Math.min(count, 4); i += 1) {
    const text = inputData[`btn${i}Text`];
    if (!text) continue;
    const type = inputData[`btn${i}Type`] || 'reply';
    const chip = { type, text, postback_data: inputData[`btn${i}Postback`] || text };
    if (type === 'open_url') {
      chip.url = inputData[`btn${i}Url`];
      if (inputData[`btn${i}UrlDesc`]) chip.description = inputData[`btn${i}UrlDesc`];
    } else if (type === 'dial') {
      chip.phone_number = inputData[`btn${i}Phone`]; // keep the + (E.164)
      if (inputData[`btn${i}Fallback`]) chip.fallback_url = inputData[`btn${i}Fallback`];
    }
    chips.push(chip);
  }
  return chips;
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
  rcs: ['text', 'image', 'video', 'file', 'card'],
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
  // RCS Rich Card — image + title + description + up to 4 reply buttons.
  card: [
    { key: 'cardMediaUrl', label: 'Image / Media URL', type: 'string', required: true, helpText: 'Direct URL of the image (or video/PDF) shown on the card. Must return media, not a web page.' },
    { key: 'cardTitle', label: 'Card Title', type: 'string', required: false, helpText: 'Up to 200 characters.' },
    { key: 'cardText', label: 'Card Description', type: 'text', required: false, helpText: 'Up to 2000 characters.' },
    { key: 'cardMediaHeight', label: 'Media Height', type: 'string', required: false, default: 'MEDIUM', choices: ['SHORT', 'MEDIUM', 'TALL'] },
    { key: 'cardButtonCount', label: 'Number of Buttons', type: 'integer', required: false, default: '0', choices: ['0', '1', '2', '3', '4'], altersDynamicFields: true, helpText: 'RCS cards support up to 4 tappable buttons. Pick how many, then fill them in below.' },
  ],
};

// The per-button fields, generated for buttons 1..N (N = Number of Buttons).
const buttonFieldsFor = (i) => [
  { key: `btn${i}Type`, label: `Button ${i} — Type`, type: 'string', default: 'reply', choices: ['reply', 'open_url', 'dial'], helpText: 'reply = quick reply · open_url = open a web page · dial = call a number.' },
  { key: `btn${i}Text`, label: `Button ${i} — Text`, type: 'string', required: true, helpText: 'Chip label, max 25 characters.' },
  { key: `btn${i}Postback`, label: `Button ${i} — Postback Data`, type: 'string', helpText: 'Identifier returned to your inbound trigger when this button is tapped (defaults to the text).' },
  { key: `btn${i}Url`, label: `Button ${i} — Link (open_url)`, type: 'string', helpText: 'Web page to open. Only for Type = open_url.' },
  { key: `btn${i}UrlDesc`, label: `Button ${i} — Link Description (open_url)`, type: 'string' },
  { key: `btn${i}Phone`, label: `Button ${i} — Phone Number (dial)`, type: 'string', helpText: 'Number to call in E.164 with + (e.g. +44…). Only for Type = dial.' },
  { key: `btn${i}Fallback`, label: `Button ${i} — Fallback URL (optional)`, type: 'string', helpText: "Web page to open if the device can't place the call." },
];

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
  // Rich Card: base fields + one block of fields per requested button.
  if (type === 'card') {
    const count = parseInt(bundle.inputData.cardButtonCount, 10) || 0;
    const fields = [...CONTENT_FIELDS.card];
    for (let i = 1; i <= Math.min(count, 4); i += 1) fields.push(...buttonFieldsFor(i));
    return fields;
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
