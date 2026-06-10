'use strict';

const perform = async (z, bundle) => {
  const body = {
    brand: bundle.inputData.brand,
    workflow: bundle.inputData.workflow
      ? JSON.parse(bundle.inputData.workflow)
      : buildDefaultWorkflow(bundle.inputData),
    ...(bundle.inputData.locale ? { locale: bundle.inputData.locale } : {}),
    ...(bundle.inputData.codeLength
      ? { code_length: parseInt(bundle.inputData.codeLength, 10) }
      : {}),
    ...(bundle.inputData.channelTimeout
      ? { channel_timeout: parseInt(bundle.inputData.channelTimeout, 10) }
      : {}),
    ...(bundle.inputData.clientRef ? { client_ref: bundle.inputData.clientRef } : {}),
    ...(bundle.inputData.callbackUrl ? { callback_url: bundle.inputData.callbackUrl } : {}),
    ...(bundle.inputData.fraudCheck !== undefined
      ? { fraud_check: bundle.inputData.fraudCheck }
      : {}),
  };

  const response = await z.request({
    url: 'https://api.nexmo.com/v2/verify',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    username: bundle.authData.apiKey,
    password: bundle.authData.apiSecret,
    body,
  });

  if (response.status >= 400) {
    const err = response.json;
    throw new z.errors.Error(
      `Verify API error: ${err.title || err.detail || JSON.stringify(err)}`
    );
  }

  return response.json;
};

const buildDefaultWorkflow = (inputData) => {
  const channel = inputData.channel || 'sms';
  const step = { channel, to: inputData.to };
  if (channel === 'email') {
    step.from = inputData.emailFrom;
  }
  return [step];
};

module.exports = {
  key: 'send_verify',
  noun: 'Verification',
  display: {
    label: 'Send Verification Code (2FA)',
    description:
      'Start a Vonage Verify v2 flow — sends a one-time PIN via SMS, Voice, WhatsApp, Email, or Silent Auth.',
  },
  operation: {
    inputFields: [
      {
        key: 'brand',
        label: 'Brand Name',
        type: 'string',
        required: true,
        helpText:
          'Shown to the end-user in the verification message (e.g. "Acme Corp").',
      },
      {
        key: 'to',
        label: 'To (Phone or Email)',
        type: 'string',
        required: true,
        helpText:
          'Recipient phone number in E.164 format, or email address when channel is "email".',
      },
      {
        key: 'channel',
        label: 'Channel',
        type: 'string',
        required: false,
        default: 'sms',
        choices: ['sms', 'whatsapp', 'whatsapp_interactive', 'voice', 'email', 'silent_auth'],
        helpText:
          'Delivery channel for the one-time code. Leave blank to use the "Custom Workflow" field.',
      },
      {
        key: 'emailFrom',
        label: 'From (Email only)',
        type: 'string',
        required: false,
        helpText: 'Sender address when Channel is "email".',
      },
      {
        key: 'locale',
        label: 'Locale',
        type: 'string',
        required: false,
        default: 'en-us',
        helpText: 'BCP-47 locale for SMS/voice messages (e.g. `es-es`, `pt-br`).',
      },
      {
        key: 'codeLength',
        label: 'PIN Length',
        type: 'integer',
        required: false,
        default: '4',
        helpText: 'Number of digits in the generated PIN (4–10).',
      },
      {
        key: 'channelTimeout',
        label: 'Channel Timeout (seconds)',
        type: 'integer',
        required: false,
        default: '300',
        helpText:
          'How long Vonage waits for the user to verify before the workflow moves to the next channel.',
      },
      {
        key: 'fraudCheck',
        label: 'Fraud Check',
        type: 'boolean',
        required: false,
        default: 'true',
        helpText: 'Disable Vonage fraud scoring for this request (not recommended).',
      },
      {
        key: 'clientRef',
        label: 'Client Reference',
        type: 'string',
        required: false,
        helpText: 'Your internal reference ID (max 16 characters).',
      },
      {
        key: 'callbackUrl',
        label: 'Event Callback URL',
        type: 'string',
        required: false,
        helpText: 'URL Vonage will POST verification events to.',
      },
      {
        key: 'workflow',
        label: 'Custom Workflow (JSON)',
        type: 'text',
        required: false,
        helpText:
          'Override the channel field with a full JSON workflow array. Example: `[{"channel":"sms","to":"15551234567"},{"channel":"voice","to":"15551234567"}]`.',
      },
    ],
    perform,
    sample: {
      request_id: 'c11236f4-00bf-4b89-84ba-88b25df97315',
    },
  },
};
