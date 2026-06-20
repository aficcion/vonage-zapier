'use strict';

// Session auth with two modes, decided by what the connection provides:
//
//   Managed (default): the user enters only API key + secret. The session
//   exchange finds (or creates) the managed Vonage application named "Zapier",
//   generates a fresh RSA key pair, registers the public key on the application
//   and returns { applicationId, privateKey } as sessionData. The application
//   plumbing stays invisible to the user.
//
//   Advanced (bring-your-own-app): the user also fills the optional
//   "Application ID" and "Private Key" fields. The exchange uses THAT
//   application and key as-is — it never creates or modifies an application,
//   and never rotates the key. For users who already run their own Vonage
//   application and want this connector to send from it.
//
// Both modes return sessionData under { applicationId, privateKey } — the same
// names the JWT middleware and the actions read from bundle.authData.
//
// The user-provided Advanced inputs use DIFFERENT field keys (appId,
// appPrivateKey) from the session output (applicationId, privateKey) on
// purpose: on a refresh, authData already carries the previous session output,
// so reusing those names would make Managed look like Advanced and silently
// stop the key self-healing. The branch reads the stable user fields.

const crypto = require('crypto');

const APP_NAME = 'Zapier';
const APPS_URL = 'https://api.nexmo.com/v2/applications';

// The Private Key field is a single-line input, so a pasted multi-line PEM
// arrives with its newlines stripped (BEGIN/END glued to one base64 run).
// Rebuild a valid PEM, re-wrapping the body at 64 columns. Tolerates escaped
// \n and already-correct PEMs; unknown input passes through so signing fails
// loudly rather than silently.
const normalizePem = (raw) => {
  const s = (raw || '').replace(/\\n/g, '\n').trim();
  const m = s.match(/-----BEGIN ([A-Z0-9 ]+?)-----([\s\S]*?)-----END \1-----/);
  if (!m) return s;
  const label = m[1].trim();
  const body = m[2].replace(/\s+/g, '');
  const wrapped = (body.match(/.{1,64}/g) || []).join('\n');
  return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----\n`;
};

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
  // Advanced (bring-your-own-app): both fields supplied -> use them as-is,
  // never touch any application or generate a key.
  const byoAppId = ((bundle.authData && bundle.authData.appId) || '').trim();
  const byoKey = normalizePem((bundle.authData && bundle.authData.appPrivateKey) || '');
  if (byoAppId && byoKey.includes('PRIVATE KEY')) {
    return { applicationId: byoAppId, privateKey: byoKey };
  }

  // Managed: provision/maintain the connector's own "Zapier" application.
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
  // Verify credentials by fetching account balance. Credentials go in the
  // Authorization: Basic header (SC-01) — never in the URL/query string, so they
  // can't leak into request logs, proxies or browser history.
  const response = await z.request({
    url: 'https://rest.nexmo.com/account/get-balance',
    headers: { Authorization: basicAuth(bundle.authData), Accept: 'application/json' },
    skipThrowForStatus: true,
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
      helpText:
        'Found next to your API Key in the [Vonage API Dashboard](https://dashboard.nexmo.com/settings) under API Settings.',
    },
    {
      key: 'appId',
      label: 'Application ID (Advanced)',
      required: false,
      type: 'string',
      helpText:
        'Optional. Leave blank to let the connector manage a Vonage application for you (recommended). Fill this **and** the Private Key only if you want to send from your own existing Vonage application.',
    },
    {
      key: 'appPrivateKey',
      label: 'Private Key (Advanced)',
      required: false,
      type: 'password',
      helpText:
        'Optional. The private key (PEM) of the application above. Required only when using your own application. Paste the whole key, including the BEGIN and END lines.',
    },
    {
      // SC-03 — OPTIONAL webhook signature verification. Left optional on
      // purpose: the Signature Secret isn't retrievable via API (the maker must
      // copy it by hand), so requiring it would add friction for everyone. Leave
      // blank to keep the current behaviour (no verification); fill it to have
      // inbound webhook triggers verify Vonage's signed JWT (see verify_webhook.js).
      key: 'signatureSecret',
      label: 'Signature Secret (Optional — verify webhooks)',
      required: false,
      type: 'password',
      helpText:
        'Optional. Copy it from your [Vonage Dashboard → Settings → Signed Webhooks](https://dashboard.nexmo.com/settings). ' +
        'When set, the inbound/status/verify-event triggers verify the signature Vonage attaches to each webhook (HS256 JWT) and reject forgeries. ' +
        'Leave blank to skip verification (default).',
    },
  ],
  sessionConfig: {
    perform: getSessionKey,
  },
  test: testAuth,
  connectionLabel: (z, bundle) => `Vonage (${bundle.authData.apiKey})`,
};
