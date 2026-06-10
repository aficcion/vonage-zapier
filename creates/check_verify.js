'use strict';

const perform = async (z, bundle) => {
  const response = await z.request({
    url: `https://api.nexmo.com/v2/verify/${bundle.inputData.requestId}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    username: bundle.authData.apiKey,
    password: bundle.authData.apiSecret,
    body: { code: bundle.inputData.code },
  });

  const data = response.json;

  if (response.status === 200) {
    return { requestId: bundle.inputData.requestId, status: 'completed', verified: true };
  }

  if (response.status === 409 && data.title === 'Conflict') {
    throw new z.errors.Error(`Verify check failed: ${data.detail || data.title}`);
  }

  if (response.status >= 400) {
    throw new z.errors.Error(
      `Verify check error: ${data.title || data.detail || JSON.stringify(data)}`
    );
  }

  return { requestId: bundle.inputData.requestId, status: 'completed', verified: true };
};

module.exports = {
  key: 'check_verify',
  noun: 'Verification Check',
  display: {
    label: 'Check Verification Code',
    description:
      'Submit the PIN a user entered to complete a Vonage Verify v2 flow.',
  },
  operation: {
    inputFields: [
      {
        key: 'requestId',
        label: 'Request ID',
        type: 'string',
        required: true,
        helpText:
          'The `request_id` returned by the "Send Verification Code" action.',
      },
      {
        key: 'code',
        label: 'PIN / Code',
        type: 'string',
        required: true,
        helpText: 'The one-time PIN the user entered.',
      },
    ],
    perform,
    sample: {
      requestId: 'c11236f4-00bf-4b89-84ba-88b25df97315',
      status: 'completed',
      verified: true,
    },
  },
};
