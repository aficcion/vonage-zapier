'use strict';

const perform = async (z, bundle) => {
  const response = await z.request({
    url: 'https://rest.nexmo.com/sms/json',
    method: 'POST',
    body: {
      api_key: bundle.authData.apiKey,
      api_secret: bundle.authData.apiSecret,
      from: bundle.inputData.from,
      to: bundle.inputData.to,
      text: bundle.inputData.text,
      type: bundle.inputData.unicode ? 'unicode' : 'text',
      ttl: bundle.inputData.ttl || undefined,
      status_report_req: bundle.inputData.statusReport ? 1 : 0,
      callback: bundle.inputData.webhookUrl || undefined,
    },
  });

  const data = response.json;
  if (data.messages[0].status !== '0') {
    throw new z.errors.Error(
      `Vonage SMS error: ${data.messages[0]['error-text']} (status ${data.messages[0].status})`
    );
  }

  return {
    messageId: data.messages[0]['message-id'],
    to: data.messages[0].to,
    remainingBalance: data.messages[0]['remaining-balance'],
    messagePrice: data.messages[0]['message-price'],
    network: data.messages[0].network,
    status: data.messages[0].status,
  };
};

module.exports = {
  key: 'send_sms',
  noun: 'SMS',
  display: {
    label: 'Send SMS',
    description: 'Send an SMS message via the Vonage SMS API.',
  },
  operation: {
    inputFields: [
      {
        key: 'from',
        label: 'From',
        type: 'string',
        required: true,
        helpText:
          'Your Vonage virtual number or alphanumeric sender ID (e.g. `15551234567` or `MyBrand`).',
      },
      {
        key: 'to',
        label: 'To',
        type: 'string',
        required: true,
        helpText: 'Recipient phone number in E.164 format (e.g. `15559876543`).',
      },
      {
        key: 'text',
        label: 'Message Text',
        type: 'text',
        required: true,
        helpText: 'The body of the SMS. Standard GSM-7 messages support up to 160 characters per segment.',
      },
      {
        key: 'unicode',
        label: 'Unicode Message',
        type: 'boolean',
        required: false,
        default: 'false',
        helpText: 'Enable for emoji or non-Latin characters. Reduces per-segment limit to 70 characters.',
      },
      {
        key: 'ttl',
        label: 'TTL (ms)',
        type: 'integer',
        required: false,
        helpText: 'Message time-to-live in milliseconds. Min 20000, max 604800000.',
      },
      {
        key: 'statusReport',
        label: 'Request Delivery Receipt',
        type: 'boolean',
        required: false,
        default: 'false',
        helpText: 'Ask Vonage to send a delivery receipt to your webhook URL.',
      },
      {
        key: 'webhookUrl',
        label: 'Delivery Receipt Webhook URL',
        type: 'string',
        required: false,
        helpText: 'URL that Vonage will POST the delivery receipt to.',
      },
    ],
    perform,
    sample: {
      messageId: '0A0000000123ABCD1',
      to: '15559876543',
      remainingBalance: '3.14159',
      messagePrice: '0.0333',
      network: '23410',
      status: '0',
    },
  },
};
