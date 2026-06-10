'use strict';

// Hidden trigger that powers the "From" dropdown on Send Message (Multi-Channel).
// Combines the account's phone numbers (usable as SMS senders) with registered
// chat-app senders (WhatsApp, RCS, Viber, Messenger) from the beta
// chatapp-accounts endpoint. Referenced only by `dynamic` on the From field.

const basicAuth = (bundle) =>
  `Basic ${Buffer.from(
    `${bundle.authData.apiKey}:${bundle.authData.apiSecret}`
  ).toString('base64')}`;

const performList = async (z, bundle) => {
  const auth = basicAuth(bundle);

  const [numbersRes, chatRes] = await Promise.all([
    z.request({
      url: 'https://rest.nexmo.com/account/numbers',
      params: { size: 100 },
      headers: { Authorization: auth, Accept: 'application/json' },
    }),
    z.request({
      url: 'https://api.nexmo.com/beta/chatapp-accounts',
      headers: { Authorization: auth, Accept: 'application/json' },
      skipThrowForStatus: true,
    }),
  ]);

  // A sender id (e.g. a number) can be usable on more than one channel, but
  // Zapier dropdowns require a unique id — collapse duplicates into one entry
  // and list the channels in the label.
  const byId = new Map();
  const add = (id, channel, name) => {
    if (!id) return;
    const existing = byId.get(id);
    if (existing) {
      if (!existing.channels.includes(channel)) existing.channels.push(channel);
      return;
    }
    byId.set(id, { id, channels: [channel], name: name || '' });
  };

  const numbers = (numbersRes.json && numbersRes.json.numbers) || [];
  numbers
    .filter((n) => (n.features || []).includes('SMS'))
    .forEach((n) => add(n.msisdn, 'sms'));

  // chatapp-accounts is beta and may be unavailable on some accounts; tolerate
  // failure so SMS senders still populate.
  const chat =
    (chatRes.json && (chatRes.json._embedded || chatRes.json.chatapp_accounts)) ||
    [];
  (Array.isArray(chat) ? chat : []).forEach((c) =>
    add(c.external_id, c.provider, c.name)
  );

  return Array.from(byId.values()).map((s) => ({
    id: s.id,
    label: `${s.id} — ${s.channels.join('/')}${s.name ? ` (${s.name})` : ''}`,
    channels: s.channels,
  }));
};

module.exports = {
  key: 'list_senders',
  noun: 'Sender',
  display: {
    label: 'List Vonage Senders',
    description: 'Internal trigger used to populate the From dropdown.',
    hidden: true,
  },
  operation: {
    perform: performList,
    sample: {
      id: '447418348162',
      label: '447418348162 — sms',
      channels: ['sms'],
    },
  },
};
