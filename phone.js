'use strict';

// Vonage's Messages/Voice APIs want E.164 *digits only* (no leading +, spaces,
// dashes or parentheses). Users naturally paste "+34 622 293 256", so normalise
// on the way out. Leave anything containing letters untouched — that's an
// alphanumeric sender ID (e.g. "MyBrand"), a chat-app agent id (e.g. "carlos"),
// or an email address (Verify) — none of which should be stripped to digits.
const normalizePhone = (value) => {
  if (typeof value !== 'string') return value;
  if (/[a-zA-Z]/.test(value)) return value;
  const digits = value.replace(/[^\d]/g, '');
  return digits || value;
};

module.exports = { normalizePhone };
