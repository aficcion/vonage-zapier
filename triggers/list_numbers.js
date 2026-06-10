'use strict';

// Hidden trigger that powers the "From" dropdown on Send SMS / Make Call.
// Lists the account's Vonage virtual numbers via the Account API (Basic auth).
// Not shown to users as a trigger — only referenced by `dynamic` on From fields.

const basicAuth = (bundle) =>
  `Basic ${Buffer.from(
    `${bundle.authData.apiKey}:${bundle.authData.apiSecret}`
  ).toString('base64')}`;

const performList = async (z, bundle) => {
  const response = await z.request({
    url: 'https://rest.nexmo.com/account/numbers',
    params: { size: 100 },
    headers: { Authorization: basicAuth(bundle), Accept: 'application/json' },
  });

  const numbers = (response.json && response.json.numbers) || [];

  return numbers
    .filter((n) => {
      const feats = n.features || [];
      // Voice-capable numbers for calls; SMS-capable for messaging. The hidden
      // trigger is reused by both From fields, so include anything that can
      // send either.
      return feats.includes('SMS') || feats.includes('VOICE');
    })
    .map((n) => {
      const feats = (n.features || []).join('/');
      return {
        id: n.msisdn,
        msisdn: n.msisdn,
        label: `${n.msisdn} — ${n.country} (${feats})`,
        country: n.country,
        features: n.features || [],
        appId: n.app_id || '',
      };
    });
};

module.exports = {
  key: 'list_numbers',
  noun: 'Number',
  display: {
    label: 'List Vonage Numbers',
    description: 'Internal trigger used to populate From dropdowns.',
    hidden: true,
  },
  operation: {
    perform: performList,
    sample: {
      id: '447418348162',
      msisdn: '447418348162',
      label: '447418348162 — GB (VOICE/SMS)',
      country: 'GB',
      features: ['VOICE', 'SMS'],
      appId: '',
    },
  },
};
