'use strict';

// Shared subscribe/unsubscribe plumbing for triggers whose webhooks live on a
// Vonage Application (Voice events, Messages inbound/status, Verify events).
// The Application API accepts Basic auth for reads and updates, so no JWT is
// needed to (de)register webhooks. PUT replaces the whole application, so we
// always GET first and send the full object back — dropping `keys` would
// unregister the application's public key and break JWT auth.

const appUrl = (applicationId) =>
  `https://api.nexmo.com/v2/applications/${applicationId}`;

// "Warn, don't clobber": a webhook slot already holding a URL that isn't ours
// (not a Zapier hook, not the value we previously set) belongs to something
// else the user set up — refuse to overwrite it unless they opt in.
const isForeignUrl = (current, previous) => {
  if (!current) return false;
  if (current === previous) return false;
  return !/(^|\.)zapier\.com/.test(current) && !current.includes('hooks.zapier');
};

const basicAuth = (bundle) =>
  `Basic ${Buffer.from(
    `${bundle.authData.apiKey}:${bundle.authData.apiSecret}`
  ).toString('base64')}`;

const fetchApp = async (z, bundle) => {
  const response = await z.request({
    url: appUrl(bundle.authData.applicationId),
    headers: { Authorization: basicAuth(bundle), Accept: 'application/json' },
  });
  if (response.status >= 400) {
    throw new z.errors.Error(
      `Could not read Vonage application: HTTP ${response.status}`
    );
  }
  return response.json;
};

const putApp = async (z, bundle, app) => {
  const response = await z.request({
    url: appUrl(bundle.authData.applicationId),
    method: 'PUT',
    headers: {
      Authorization: basicAuth(bundle),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: app,
  });
  if (response.status >= 400) {
    throw new z.errors.Error(
      `Could not update Vonage application webhooks: HTTP ${response.status}`
    );
  }
  return response.json;
};

// Sets capabilities[capability].webhooks[hook].address and returns the
// previous address so unsubscribe can restore it.
const setAppWebhook = async (z, bundle, capability, hook, address) => {
  if (!bundle.authData.applicationId) {
    throw new z.errors.Error(
      'This trigger registers a webhook on a Vonage Application — add an Application ID (and Private Key) to your Vonage connection.'
    );
  }

  const app = await fetchApp(z, bundle);

  app.capabilities = app.capabilities || {};
  const cap = (app.capabilities[capability] =
    app.capabilities[capability] || {});
  cap.webhooks = cap.webhooks || {};
  const previous = cap.webhooks[hook] ? cap.webhooks[hook].address : '';

  // When subscribing, protect a foreign URL already in this slot unless the
  // user ticked "take over". `address` is empty on unsubscribe — never block.
  if (address && !bundle.inputData.takeOver && isForeignUrl(previous, '')) {
    throw new z.errors.Error(
      `Your Vonage application's "${capability}/${hook}" webhook already points at another URL (${previous}). ` +
        'Turning this Zap on would replace it and could break whatever depends on it. ' +
        'If you want this Zap to take over that webhook while it is on, tick "Take over the webhook" below and try again.'
    );
  }

  if (address) {
    cap.webhooks[hook] = { address, http_method: 'POST' };
  } else {
    delete cap.webhooks[hook];
  }

  await putApp(z, bundle, app);
  return previous;
};

// Builds a performSubscribe/performUnsubscribe pair for one capability webhook.
// Note: an application has ONE address per webhook slot, so only one Zap at a
// time can subscribe to a given (application, capability, hook) combination —
// the most recently enabled Zap wins.
const makeAppWebhookHooks = (capability, hook) => ({
  subscribeHook: async (z, bundle) => {
    const previousUrl = await setAppWebhook(
      z,
      bundle,
      capability,
      hook,
      bundle.targetUrl
    );
    return { webhookUrl: bundle.targetUrl, previousUrl };
  },
  unsubscribeHook: async (z, bundle) => {
    const previousUrl =
      (bundle.subscribeData && bundle.subscribeData.previousUrl) || '';
    await setAppWebhook(z, bundle, capability, hook, previousUrl);
    return {};
  },
});

// Drop-in inputField for any hook trigger so the user can opt into overwriting
// a foreign webhook URL.
const takeOverField = {
  key: 'takeOver',
  label: 'Take over the webhook',
  type: 'boolean',
  required: false,
  default: 'false',
  helpText:
    'Leave off to protect a webhook another integration may have set. Turn on to let this Zap replace it while the Zap is on (the previous URL is restored when you turn the Zap off).',
};

module.exports = { makeAppWebhookHooks, isForeignUrl, takeOverField };
