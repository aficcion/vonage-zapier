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
    bundle.authData._jwt = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  } catch (err) {
    z.console.log('JWT generation skipped:', err.message);
  }

  return request;
};

module.exports = { addJwtToBundle };
