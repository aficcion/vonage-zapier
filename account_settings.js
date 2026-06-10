'use strict';

// Account-level webhook plumbing (Account Settings API, Basic auth).
// Two single-value slots live here: moCallBackUrl (inbound SMS) and
// drCallBackUrl (delivery receipts) for numbers not linked to an application.
// Shares the "warn, don't clobber" rule with app_webhooks.

const { isForeignUrl, takeOverField } = require('./app_webhooks');

const SETTINGS_URL = 'https://rest.nexmo.com/account/settings';

// POST with no change returns the current settings — used to read the slot
// before deciding whether to overwrite it.
const readSettings = async (z, bundle) => {
  const response = await z.request({
    url: SETTINGS_URL,
    method: 'POST',
    params: {
      api_key: bundle.authData.apiKey,
      api_secret: bundle.authData.apiSecret,
    },
  });
  if (response.status >= 400) {
    throw new z.errors.Error(
      `Could not read Vonage account settings: HTTP ${response.status}`
    );
  }
  return response.json || {};
};

const writeSetting = async (z, bundle, param, url) => {
  const response = await z.request({
    url: SETTINGS_URL,
    method: 'POST',
    params: {
      api_key: bundle.authData.apiKey,
      api_secret: bundle.authData.apiSecret,
      [param]: url,
    },
  });
  if (response.status >= 400) {
    throw new z.errors.Error(
      `Could not update Vonage account webhook: HTTP ${response.status}`
    );
  }
  return response.json || {};
};

// Builds a performSubscribe/performUnsubscribe pair for one account-level
// callback slot. `param` is the write key (moCallBackUrl / drCallBackUrl);
// `readKey` is the matching field in the settings response.
const makeAccountWebhookHooks = (param, readKey, label) => ({
  subscribeHook: async (z, bundle) => {
    const settings = await readSettings(z, bundle);
    const previous = settings[readKey] || '';

    if (!bundle.inputData.takeOver && isForeignUrl(previous, '')) {
      throw new z.errors.Error(
        `Your Vonage account's ${label} webhook already points at another URL (${previous}). ` +
          'Turning this Zap on would replace it and could break whatever depends on it. ' +
          'If you want this Zap to take over it while the Zap is on, tick "Take over the webhook" below and try again.'
      );
    }

    await writeSetting(z, bundle, param, bundle.targetUrl);
    return { webhookUrl: bundle.targetUrl, previousUrl: previous };
  },
  unsubscribeHook: async (z, bundle) => {
    const previous =
      (bundle.subscribeData && bundle.subscribeData.previousUrl) || '';
    await writeSetting(z, bundle, param, previous);
    return {};
  },
});

module.exports = { makeAccountWebhookHooks, takeOverField, readSettings };
