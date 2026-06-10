'use strict';

const buildNcco = (inputData) => {
  const actions = [];

  if (inputData.ttsText) {
    actions.push({
      action: 'talk',
      text: inputData.ttsText,
      language: inputData.ttsLanguage || 'en-US',
      style: inputData.ttsStyle ? parseInt(inputData.ttsStyle, 10) : 0,
      premium: inputData.ttsPremium === true,
    });
  }

  if (inputData.streamUrl) {
    actions.push({
      action: 'stream',
      streamUrl: [inputData.streamUrl],
      level: inputData.streamLevel ? parseFloat(inputData.streamLevel) : 1,
    });
  }

  if (inputData.recordCall) {
    actions.push({ action: 'record', eventUrl: inputData.recordWebhookUrl ? [inputData.recordWebhookUrl] : undefined });
  }

  if (inputData.connectTo) {
    actions.push({
      action: 'connect',
      endpoint: [{ type: 'phone', number: inputData.connectTo }],
    });
  }

  return actions.length > 0 ? actions : [{ action: 'talk', text: 'Hello from Vonage via Zapier.' }];
};

const perform = async (z, bundle) => {
  if (!bundle.authData.applicationId || !bundle.authData.privateKey) {
    throw new z.errors.Error(
      'Voice API requires an Application ID and Private Key in your Vonage connection.'
    );
  }

  const body = {
    to: [{ type: 'phone', number: bundle.inputData.to }],
    from: { type: 'phone', number: bundle.inputData.from },
    ...(bundle.inputData.answerUrl
      ? { answer_url: [bundle.inputData.answerUrl], answer_method: 'GET' }
      : { ncco: buildNcco(bundle.inputData) }),
    ...(bundle.inputData.eventUrl
      ? { event_url: [bundle.inputData.eventUrl], event_method: 'POST' }
      : {}),
    ...(bundle.inputData.machineDetection
      ? { machine_detection: bundle.inputData.machineDetection }
      : {}),
    ...(bundle.inputData.lengthTimer
      ? { length_timer: parseInt(bundle.inputData.lengthTimer, 10) }
      : {}),
  };

  const response = await z.request({
    url: 'https://api.nexmo.com/v1/calls',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bundle.authData._jwt}`,
    },
    body,
  });

  if (response.status >= 400) {
    const err = response.json;
    throw new z.errors.Error(
      `Voice API error: ${err.error_title || err.description || JSON.stringify(err)}`
    );
  }

  return response.json;
};

module.exports = {
  key: 'make_call',
  noun: 'Call',
  display: {
    label: 'Make Outbound Call',
    description:
      'Initiate an outbound phone call via the Vonage Voice API. Supports TTS, audio stream, recording, and call forwarding.',
  },
  operation: {
    inputFields: [
      {
        key: 'to',
        label: 'To (Phone Number)',
        type: 'string',
        required: true,
        helpText: 'Destination number in E.164 format (e.g. `15551234567`).',
      },
      {
        key: 'from',
        label: 'From (Virtual Number)',
        type: 'string',
        required: true,
        helpText: 'Your Vonage virtual number in E.164 format.',
      },
      {
        key: 'answerUrl',
        label: 'NCCO Answer URL (optional)',
        type: 'string',
        required: false,
        helpText:
          'URL that returns an NCCO JSON. If provided, the fields below are ignored.',
      },
      {
        key: 'ttsText',
        label: 'Text-to-Speech Message',
        type: 'text',
        required: false,
        helpText: 'Text Vonage will read to the called party when they answer.',
      },
      {
        key: 'ttsLanguage',
        label: 'TTS Language',
        type: 'string',
        required: false,
        default: 'en-US',
        helpText: 'BCP-47 language code (e.g. `en-US`, `es-ES`, `pt-BR`).',
      },
      {
        key: 'ttsStyle',
        label: 'TTS Voice Style',
        type: 'integer',
        required: false,
        default: '0',
        helpText: 'Voice style index. See Vonage docs for available styles per language.',
      },
      {
        key: 'ttsPremium',
        label: 'Use Premium TTS Voice',
        type: 'boolean',
        required: false,
        default: 'false',
      },
      {
        key: 'streamUrl',
        label: 'Audio Stream URL',
        type: 'string',
        required: false,
        helpText: 'URL of an MP3 or WAV file to play during the call.',
      },
      {
        key: 'connectTo',
        label: 'Forward / Connect To Number',
        type: 'string',
        required: false,
        helpText: 'Phone number to connect the call to after TTS/audio plays.',
      },
      {
        key: 'recordCall',
        label: 'Record Call',
        type: 'boolean',
        required: false,
        default: 'false',
      },
      {
        key: 'recordWebhookUrl',
        label: 'Recording Webhook URL',
        type: 'string',
        required: false,
        helpText: 'URL Vonage will POST the recording info to when the call ends.',
      },
      {
        key: 'machineDetection',
        label: 'Answering Machine Detection',
        type: 'string',
        required: false,
        choices: ['continue', 'hangup'],
      },
      {
        key: 'lengthTimer',
        label: 'Max Call Duration (seconds)',
        type: 'integer',
        required: false,
        helpText: 'Maximum call length in seconds (1–7200).',
      },
      {
        key: 'eventUrl',
        label: 'Event Webhook URL',
        type: 'string',
        required: false,
        helpText: 'URL for call status events (ringing, answered, completed, etc.).',
      },
    ],
    perform,
    sample: {
      uuid: 'aaaaaaaa-bbbb-cccc-dddd-0123456789ab',
      status: 'started',
      direction: 'outbound',
      rate: '0.0390',
      price: '0.00',
      duration: '0',
      network: null,
    },
  },
};
