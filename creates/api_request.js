'use strict';

// API Request — a raw, authenticated passthrough to any Vonage API endpoint.
// The escape hatch for endpoints the connector doesn't model as a first-class
// action (parity with Twilio's / Telnyx's generic "API Request"). The maker
// picks the method, URL, auth scheme and optional headers/query/body; the
// connector signs the call and returns the raw status + headers + body.

// Parse an optional JSON text input. Empty -> undefined; an object passes
// through (Zapier can hand back a parsed dict); a non-empty string is JSON.parse
// with a clear, field-named error instead of an opaque "Unexpected token".
const parseJsonField = (z, raw, label) => {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'object') return raw;
  const str = String(raw).trim();
  if (!str) return undefined;
  try {
    return JSON.parse(str);
  } catch (e) {
    throw new z.errors.Error(`The "${label}" field isn't valid JSON: ${e.message}`);
  }
};

const perform = async (z, bundle) => {
  const { method, url, auth } = bundle.inputData;
  const headers = parseJsonField(z, bundle.inputData.requestHeaders, 'Headers') || {};
  const params = parseJsonField(z, bundle.inputData.queryParams, 'Query Params') || {};
  const body = parseJsonField(z, bundle.inputData.requestBody, 'Body');

  // Tolerate a URL pasted without a scheme.
  const fullUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  const authHeader =
    auth === 'basic'
      ? `Basic ${Buffer.from(
          `${bundle.authData.apiKey}:${bundle.authData.apiSecret}`
        ).toString('base64')}`
      : // Default: the managed application JWT. On the first request of an
        // invocation _jwt is still undefined, so this renders "Bearer undefined"
        // and the beforeRequest middleware patches in the freshly minted token.
        `Bearer ${bundle.authData._jwt}`;

  const response = await z.request({
    url: fullUrl,
    method: method || 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: authHeader,
      ...headers,
    },
    params,
    ...(body !== undefined ? { body } : {}),
    skipThrowForStatus: true,
  });

  // Flatten the response headers to a plain object for the Zap.
  const responseHeaders = {};
  if (response.headers && typeof response.headers.entries === 'function') {
    for (const [key, value] of response.headers.entries()) {
      responseHeaders[key] = value;
    }
  }

  // Prefer parsed JSON; fall back to the raw text body. A 4xx/5xx is returned
  // (not thrown) so the maker can inspect the body and branch on the status.
  let responseBody = response.json;
  if (responseBody === undefined) {
    responseBody = response.content;
  }

  return {
    status: response.status,
    headers: responseHeaders,
    body: responseBody,
  };
};

module.exports = {
  key: 'api_request',
  noun: 'API Request',
  display: {
    label: 'API Request',
    description:
      'Make a raw authenticated HTTP request to any Vonage API endpoint (advanced).',
  },
  operation: {
    inputFields: [
      {
        key: 'method',
        label: 'Method',
        type: 'string',
        required: false,
        choices: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        default: 'GET',
        helpText: 'HTTP method for the request.',
      },
      {
        key: 'url',
        label: 'URL',
        type: 'string',
        required: true,
        helpText:
          'Full Vonage API URL, e.g. `https://api.nexmo.com/v1/messages` (JWT) ' +
          'or `https://rest.nexmo.com/account/get-balance` (Basic). ' +
          'If you omit the scheme, `https://` is assumed.',
      },
      {
        key: 'auth',
        label: 'Authentication',
        type: 'string',
        required: false,
        choices: ['jwt', 'basic'],
        default: 'jwt',
        helpText:
          'How to authenticate. `jwt` = the managed application Bearer token ' +
          '(Messages, Voice, Verify, Applications). `basic` = your API key/secret ' +
          '(account, balance, Number Insight, legacy REST endpoints).',
      },
      {
        key: 'requestHeaders',
        label: 'Headers (JSON)',
        type: 'text',
        required: false,
        helpText:
          'Optional JSON object of extra request headers, e.g. `{"Content-Type": "application/json"}`. ' +
          'The Authorization header is set for you.',
      },
      {
        key: 'queryParams',
        label: 'Query Parameters (JSON)',
        type: 'text',
        required: false,
        helpText:
          'Optional JSON object of query-string parameters, e.g. `{"api_key": "abc", "number": "447..."}`.',
      },
      {
        key: 'requestBody',
        label: 'Body (JSON)',
        type: 'text',
        required: false,
        helpText:
          'Optional JSON request body (for POST/PUT/PATCH), e.g. the Messages API send payload.',
      },
    ],
    perform,
    sample: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: { message_uuid: 'aaaaaaaa-bbbb-cccc-dddd-0123456789ab' },
    },
    // No explicit outputFields: the response shape ({ status, headers, body })
    // is fully dynamic — headers and body are arbitrary dicts that vary per
    // endpoint — so the sample drives the output mapping. Declaring them with a
    // fixed scalar type would misreport the dict bodies (D024).
  },
};
