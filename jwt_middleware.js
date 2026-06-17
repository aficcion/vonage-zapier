'use strict';

/**
 * beforeRequest middleware — signature is (request, z, bundle).
 * Generates a Vonage JWT and attaches it to bundle.authData._jwt
 * for actions that need application-level auth (Voice, Messages channels).
 * Falls back gracefully when applicationId / privateKey are absent (SMS-only setup).
 */
const addJwtToBundle = async (request, z, bundle) => {
  if (!bundle.authData || !bundle.authData.applicationId || !bundle.authData.privateKey) {
    return request;
  }

  try {
    const jwt = require('jsonwebtoken');
    const crypto = require('crypto');

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      application_id: bundle.authData.applicationId,
      iat: now,
      jti: crypto.randomUUID(),
      exp: now + 900, // 15 minutes
    };

    const privateKey = bundle.authData.privateKey.replace(/\\n/g, '\n');
    const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
    bundle.authData._jwt = token;

    // Performs interpolate `Bearer ${bundle.authData._jwt}` BEFORE this middleware
    // runs, so on the first request of an invocation the header arrives here as
    // the literal string "Bearer undefined". Patch the request directly.
    if (request.headers && request.headers.Authorization === 'Bearer undefined') {
      request.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    z.console.log('JWT generation skipped:', err.message);
  }

  return request;
};

/**
 * afterResponse middleware — self-healing for JWT auth.
 * A 401 on a Bearer-authenticated request means the registered public key no
 * longer matches our private key (rotated/overwritten outside the connector).
 * RefreshAuthError makes Zapier re-run the session exchange — which registers
 * a fresh key pair on the managed application — and retry the request.
 * Basic-auth 401s (bad key/secret) fall through as normal errors.
 */
const refreshOnInvalidJwt = (response, z, bundle) => {
  const headers = (response.request && response.request.headers) || {};
  const authHeader = headers.Authorization || '';
  if (response.status === 401 && authHeader.startsWith('Bearer ')) {
    // Chat-channel sends mark themselves (see send_message). There a 401 means
    // the sender isn't linked to the connector's Vonage application — a fresh
    // key pair won't fix that, and the refresh-retry cycle would surface as a
    // cryptic "halted execution" error. Say what's actually wrong instead.
    const chatChannel = headers['X-Connector-Chat-Channel'];
    if (chatChannel) {
      throw new z.errors.Error(
        `Vonage rejected the ${chatChannel} send (401). This usually means the sender isn't linked to the Vonage application this connection manages — link it under External Accounts in the Vonage dashboard, or pick a registered sender from the From dropdown. If the sender is correctly linked, reconnect your Vonage account and try again.`
      );
    }
    // Advanced (bring-your-own-app): re-running the session exchange returns the
    // same user-supplied key, so a refresh can't fix a 401 — say what's wrong.
    if (bundle.authData && (bundle.authData.appId || '').trim()) {
      throw new z.errors.Error(
        'Vonage rejected the request (401) for your Application ID / Private Key. Check that the Application ID is correct, the private key matches the public key registered on that application, and that your API key/secret belong to the same Vonage account.'
      );
    }
    throw new z.errors.RefreshAuthError();
  }
  return response;
};

module.exports = { addJwtToBundle, refreshOnInvalidJwt };
