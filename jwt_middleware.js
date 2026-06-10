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

module.exports = { addJwtToBundle };
