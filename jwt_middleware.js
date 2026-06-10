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
  const authHeader =
    (response.request &&
      response.request.headers &&
      response.request.headers.Authorization) ||
    '';
  if (response.status === 401 && authHeader.startsWith('Bearer ')) {
    throw new z.errors.RefreshAuthError();
  }
  return response;
};

module.exports = { addJwtToBundle, refreshOnInvalidJwt };
