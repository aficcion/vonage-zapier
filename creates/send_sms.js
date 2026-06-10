'use strict';

// Send SMS over the Messages API (POST /v1/messages), signed with the managed
// application JWT. The managed JWT is accepted for any sender on the account —
// linked, unlinked, or alphanumeric — so SMS never needs per-sender custody.
// The middleware injects the token (see the "Bearer undefined" patch).
const perform = async (z, bundle) => {
  const { from, to, text, unicode, ttl } = bundle.inputData;

  const payload = {
    channel: 'sms',
    message_type: 'text',
    from,
    to,
    text,
    client_ref: 'vonage-zapier',
    sms: { encoding_type: unicode ? 'unicode' : 'text' },
    ...(ttl ? { ttl: parseInt(ttl, 10) } : {}),
  };

  const response = await z.request({
    url: 'https://api.nexmo.com/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${bundle.authData._jwt}`,
    },
    body: payload,
    skipThrowForStatus: true,
  });

  if (response.status >= 400) {
    const err = response.json || {};
    throw new z.errors.Error(
      `Vonage SMS error: ${err.title || err.detail || JSON.stringify(err)}`
    );
  }

  const data = response.json || {};
  return {
    messageId: data.message_uuid,
    messageUuid: data.message_uuid,
    to,
    from,
    status: 'submitted',
  };
};

module.exports = {
  key: 'send_sms',
  noun: 'SMS',
  display: {
    label: 'Send SMS',
    description: 'Send an SMS message via Vonage.',
  },
  operation: {
    inputFields: [
      {
        key: 'from',
        label: 'From',
        type: 'string',
        required: true,
        dynamic: 'list_numbers.id.label',
        helpText:
          'Pick one of your Vonage numbers, or type a virtual number or alphanumeric sender ID (e.g. `MyBrand`).',
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
        helpText:
          'The body of the SMS. Standard GSM-7 messages support up to 160 characters per segment.',
      },
      {
        key: 'unicode',
        label: 'Unicode Message',
        type: 'boolean',
        required: false,
        default: 'false',
        helpText:
          'Enable for emoji or non-Latin characters. Reduces per-segment limit to 70 characters.',
      },
      {
        key: 'ttl',
        label: 'TTL (ms)',
        type: 'integer',
        required: false,
        helpText: 'Message time-to-live in milliseconds.',
      },
    ],
    perform,
    sample: {
      messageId: 'aaaaaaaa-bbbb-cccc-dddd-0123456789ab',
      messageUuid: 'aaaaaaaa-bbbb-cccc-dddd-0123456789ab',
      to: '15559876543',
      from: '15551234567',
      status: 'submitted',
    },
  },
};
