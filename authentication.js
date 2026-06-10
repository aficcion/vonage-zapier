'use strict';

// Session auth: the user only enters API key + secret. The session exchange
// finds (or creates) the managed Vonage application named "Zapier", generates
// a fresh RSA key pair, registers the public key on the application and
// returns { applicationId, privateKey } as sessionData — same field names the
// JWT middleware and the actions already read from bundle.authData, so the
// application plumbing stays invisible to the user.

const crypto = require('crypto');

const APP_NAME = 'Zapier';
const APPS_URL = 'https://api.nexmo.com/v2/applications';

const basicAuth = (authData) =>
  `Basic ${Buffer.from(`${authData.apiKey}:${authData.apiSecret}`).toString(
    'base64'
  )}`;

const jsonHeaders = (bundle) => ({
  Authorization: basicAuth(bundle.authData),
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

const findManagedApp = async (z, bundle) => {
  const response = await z.request({
    url: APPS_URL,
    params: { page_size: 100 },
    headers: jsonHeaders(bundle),
    skipThrowForStatus: true,
  });

  if (response.status === 401) {
    throw new z.errors.Error(
      'Invalid API Key or Secret',
      'AuthenticationError',
      401
    );
  }
  if (response.status >= 400) {
    throw new z.errors.Error(
      `Could not list Vonage applications: HTTP ${response.status}`
    );
  }

  const apps =
    (response.json._embedded && response.json._embedded.applications) || [];
  return apps.find((app) => app.name === APP_NAME) || null;
};

// PUT replaces the whole application, so GET the full object first and only
// swap the public key — dropping capabilities would unregister the webhooks
// that active Zaps rely on.
const registerPublicKey = async (z, bundle, applicationId, publicKey) => {
  const getResponse = await z.request({
    url: `${APPS_URL}/${applicationId}`,
    headers: jsonHeaders(bundle),
    skipThrowForStatus: true,
  });
  if (getResponse.status >= 400) {
    throw new z.errors.Error(
      `Could not read Vonage application: HTTP ${getResponse.status}`
    );
  }

  const app = getResponse.json;
  app.keys = { public_key: publicKey };

  const putResponse = await z.request({
    url: `${APPS_URL}/${applicationId}`,
    method: 'PUT',
    headers: jsonHeaders(bundle),
    body: app,
    skipThrowForStatus: true,
  });
  if (putResponse.status >= 400) {
    throw new z.errors.Error(
      `Could not register key on Vonage application: HTTP ${putResponse.status}`
    );
  }
};

const createManagedApp = async (z, bundle, publicKey) => {
  const response = await z.request({
    url: APPS_URL,
    method: 'POST',
    headers: jsonHeaders(bundle),
    body: {
      name: APP_NAME,
      capabilities: {
        voice: {
          webhooks: {
            // Public sample NCCO so inbound calls to linked numbers are answered.
            answer_url: {
              address:
                'https://nexmo-community.github.io/ncco-examples/talk.json',
              http_method: 'GET',
            },
            event_url: {
              address: 'https://example.com/voice/event',
              http_method: 'POST',
            },
          },
        },
        messages: {
          webhooks: {
            inbound_url: {
              address: 'https://example.com/messages/inbound',
              http_method: 'POST',
            },
            status_url: {
              address: 'https://example.com/messages/status',
              http_method: 'POST',
            },
          },
        },
        verify: {
          webhooks: {
            status_url: {
              address: 'https://example.com/verify/status',
              http_method: 'POST',
            },
          },
        },
      },
      keys: { public_key: publicKey },
    },
    skipThrowForStatus: true,
  });

  if (response.status >= 400) {
    throw new z.errors.Error(
      `Could not create the managed Vonage application: HTTP ${response.status}`
    );
  }
  return response.json;
};

// sessionConfig.perform — runs on connect and whenever a RefreshAuthError is
// thrown, so each run re-registers a fresh key (that re-registration IS the
// self-healing).
const getSessionKey = async (z, bundle) => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  let app = await findManagedApp(z, bundle);
  if (app) {
    await registerPublicKey(z, bundle, app.id, publicKey);
  } else {
    app = await createManagedApp(z, bundle, publicKey);
  }

  return { applicationId: app.id, privateKey };
};

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
    throw new z.errors.Error(
      'Invalid API Key or Secret',
      'AuthenticationError',
      401
    );
  }

  const data = response.json;
  return { balance: data.value, autoReload: data.autoReload };
};

module.exports = {
  type: 'session',
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
  ],
  sessionConfig: {
    perform: getSessionKey,
  },
  test: testAuth,
  connectionLabel: (z, bundle) => `Vonage (${bundle.authData.apiKey})`,
};
