'use strict';

const perform = async (z, bundle) => {
  const response = await z.request({
    url: `https://api.nexmo.com/v2/verify/${bundle.inputData.requestId}/cancel`,
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    auth: [bundle.authData.apiKey, bundle.authData.apiSecret],
  });

  if (response.status === 204) {
    return { requestId: bundle.inputData.requestId, cancelled: true };
  }

  const err = response.json;
  throw new z.errors.Error(
    `Cancel verify error: ${err.title || err.detail || JSON.stringify(err)}`
  );
};

module.exports = {
  key: 'cancel_verify',
  noun: 'Verification',
  display: {
    label: 'Cancel Verification Request',
    description: 'Cancel an in-progress Vonage Verify v2 workflow.',
  },
  operation: {
    inputFields: [
      {
        key: 'requestId',
        label: 'Request ID',
        type: 'string',
        required: true,
        helpText: 'The `request_id` of the verification to cancel.',
      },
    ],
    perform,
    sample: {
      requestId: 'c11236f4-00bf-4b89-84ba-88b25df97315',
      cancelled: true,
    },
  },
};
