'use strict';

// Send RCS — the RCS channel of the Messages API, surfaced as a named action
// for discoverability. It is the full RCS feature set (text, image, video,
// file, rich card, and carousel with buttons); the only difference from
// "Send Message (Multi-Channel)" is that the channel is fixed to RCS.
const { makeChannelSend } = require('./_channel_send');

module.exports = makeChannelSend('rcs', {
  key: 'send_rcs',
  noun: 'RCS Message',
  label: 'Send RCS Message',
  description: 'Send an RCS message (text, media, rich card, or carousel) via Vonage.',
});
