'use strict';

const testAuth = async (z, bundle) => {
  // Verify credentials by fetching account balance
  const response = await z.request({
    url: 'https://rest.nexmo.com/account/get-balance',
    params: {
      api_key: bundle.authData.apiKey,
      api_secret: bundle.authData.apiSecret,
    },
  });

  if (response.status !== 200) {
    throw new z.errors.Error('Invalid API Key or Secret', 'AuthenticationError', 401);
  }

  const data = response.json;
  return { balance: data.value, autoReload: data.autoReload };
};

module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'apiKey',
      label: 'API Key',
      required: true,
      type: 'string',
      helpText:
        'Found in your [Vonage API Dashboard](https://dashboard.nexmo.com/) under API Settings.',
    },
    {
      key: 'apiSecret',
      label: 'API Secret',
      required: true,
      type: 'password',
      helpText: 'Found next to your API Key in the Vonage dashboard.',
    },
    {
      key: 'applicationId',
      label: 'Application ID (optional)',
      required: false,
      type: 'string',
      helpText:
        'Required for Voice API and Messages API. Create one at [Vonage Applications](https://dashboard.nexmo.com/applications).',
    },
    {
      key: 'privateKey',
      label: 'Private Key (optional)',
      required: false,
      type: 'text',
      helpText:
        'PEM private key content (not the file path) for your Vonage Application. Paste the full key including the BEGIN/END lines.',
    },
  ],
  test: testAuth,
  connectionLabel: (z, bundle) =>
    `Vonage (${bundle.authData.apiKey})`,
};
