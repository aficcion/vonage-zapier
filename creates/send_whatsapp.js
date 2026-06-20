'use strict';

// Send WhatsApp — the WhatsApp channel of the Messages API, surfaced as a
// named action for discoverability. It is the full WhatsApp feature set (text,
// image, audio, video, file, template); the only difference from
// "Send Message (Multi-Channel)" is that the channel is fixed to WhatsApp.
const { makeChannelSend } = require('./_channel_send');

module.exports = makeChannelSend('whatsapp', {
  key: 'send_whatsapp',
  noun: 'WhatsApp Message',
  label: 'Send WhatsApp Message',
  description: 'Send a WhatsApp message (text, media, or template) via Vonage.',
});
