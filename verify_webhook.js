'use strict';

// SC-03 — OPTIONAL inbound webhook signature verification.
//
// Vonage signs each webhook it sends by attaching a JWT in the request's
// `Authorization: Bearer <jwt>` header, signed **HS256** with the account's
// Signature Secret (NOT the application RSA key, and NOT a JWKS/RS256 token).
// The JWT also carries a `payload_hash` claim = SHA-256 hex of the raw body.
//
// Verification is opt-in: the Signature Secret isn't retrievable via API, so we
// don't force every maker to paste it. When `bundle.authData.signatureSecret`
// is empty we return immediately and the trigger fires exactly as before. When
// it's set we verify the JWT (and, when present, the payload hash) and throw on
// any mismatch so a forged webhook can't fire a Zap.

const crypto = require('crypto');

// Pull the Bearer token out of the raw request headers, case-insensitively.
const getBearer = (bundle) => {
  const raw = (bundle && bundle.rawRequest) || {};
  const headers = raw.headers || {};
  let authHeader = '';
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'authorization') {
      authHeader = headers[key];
      break;
    }
  }
  const m = /^Bearer\s+(.+)$/i.exec(String(authHeader || '').trim());
  return m ? m[1] : '';
};

const verifyWebhookSignature = (z, bundle) => {
  const secret = (bundle && bundle.authData && bundle.authData.signatureSecret) || '';
  // Not configured -> behave exactly as today (no verification).
  if (!secret) return;

  const token = getBearer(bundle);
  if (!token) {
    throw new z.errors.Error(
      'Webhook signature verification is enabled but this request has no Bearer token. ' +
        'Either the webhook is unsigned or it did not come from Vonage. Remove the Signature Secret from the connection to disable verification.'
    );
  }

  const jwt = require('jsonwebtoken');
  let decoded;
  try {
    // Vonage signs webhooks HS256 with the Signature Secret.
    decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch (err) {
    throw new z.errors.Error(
      `Webhook signature verification failed (${err.message}). The request was not signed with your Vonage Signature Secret — rejecting it.`
    );
  }

  // Best-effort body integrity check: when the token carries a payload_hash and
  // we can see the raw body, confirm SHA-256(rawBody) matches.
  const rawBody = bundle.rawRequest && bundle.rawRequest.content;
  if (decoded && decoded.payload_hash && typeof rawBody === 'string' && rawBody.length) {
    const computed = crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex');
    if (computed !== decoded.payload_hash) {
      throw new z.errors.Error(
        'Webhook signature verification failed: the request body does not match the signed payload hash — rejecting it.'
      );
    }
  }
};

module.exports = { verifyWebhookSignature };
