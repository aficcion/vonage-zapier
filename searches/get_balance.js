'use strict';

const basicAuth = (authData) =>
  `Basic ${Buffer.from(`${authData.apiKey}:${authData.apiSecret}`).toString('base64')}`;

const perform = async (z, bundle) => {
  // SC-01 — credentials in the Authorization: Basic header, not the query string
  // (rest.nexmo.com/account/get-balance accepts Basic, verified).
  const response = await z.request({
    url: 'https://rest.nexmo.com/account/get-balance',
    headers: { Authorization: basicAuth(bundle.authData), Accept: 'application/json' },
  });

  const data = response.json;
  const threshold = parseFloat(bundle.inputData.threshold);

  return [
    {
      id: 'balance',
      balance: data.value,
      currency: 'EUR',
      autoReload: data.autoReload || false,
      belowThreshold: !isNaN(threshold) ? data.value < threshold : false,
    },
  ];
};

module.exports = {
  key: 'get_balance',
  noun: 'Balance',
  display: {
    label: 'Get Account Balance',
    description:
      'Retrieve the current Vonage account balance (EUR). Combine with a Schedule trigger and a Filter step to build a low-balance alert.',
  },
  operation: {
    inputFields: [
      {
        key: 'threshold',
        label: 'Low Balance Threshold (EUR)',
        type: 'number',
        required: false,
        helpText:
          'Optional. If set, the result includes `Below Threshold = true` whenever the balance is under this amount — filter on it to build a low-balance alert.',
      },
    ],
    perform,
    sample: {
      id: 'balance',
      balance: 10.28,
      currency: 'EUR',
      autoReload: false,
      belowThreshold: false,
    },
  },
};
