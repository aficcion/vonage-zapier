'use strict';

const LEVEL_URLS = {
  basic: 'https://api.nexmo.com/ni/basic/json',
  standard: 'https://api.nexmo.com/ni/standard/json',
  advanced: 'https://api.nexmo.com/ni/advanced/json',
};

const perform = async (z, bundle) => {
  const level = bundle.inputData.level || 'standard';
  const url = LEVEL_URLS[level];

  const params = {
    api_key: bundle.authData.apiKey,
    api_secret: bundle.authData.apiSecret,
    number: bundle.inputData.number,
    ...(bundle.inputData.countryCode ? { country: bundle.inputData.countryCode } : {}),
    ...(level !== 'basic' && bundle.inputData.cnam ? { cnam: true } : {}),
  };

  const response = await z.request({ url, params });
  const data = response.json;

  if (data.status !== 0) {
    throw new z.errors.Error(
      `Number Insight error [${data.status}]: ${data.status_message}`
    );
  }

  return [
    {
      // Common
      number: data.international_format_number || bundle.inputData.number,
      nationalNumber: data.national_format_number || '',
      countryCode: data.country_code || '',
      countryCodeIso3: data.country_code_iso3 || '',
      countryName: data.country_name || '',
      countryPrefix: data.country_prefix || '',
      // Standard+
      requestId: data.request_id || '',
      originalNumber: data.original_request_id || '',
      ported: data.ported || '',
      currentCarrierName: data.current_carrier ? data.current_carrier.name : '',
      currentCarrierCountry: data.current_carrier ? data.current_carrier.country : '',
      currentCarrierNetworkCode: data.current_carrier ? data.current_carrier.network_code : '',
      currentCarrierNetworkType: data.current_carrier ? data.current_carrier.network_type : '',
      originalCarrierName: data.original_carrier ? data.original_carrier.name : '',
      // Advanced
      validNumber: data.valid_number || '',
      reachable: data.reachable || '',
      roaming: data.roaming ? data.roaming.status : '',
      roamingCountry: data.roaming ? data.roaming.roaming_country_code : '',
      roamingCarrier: data.roaming ? data.roaming.roaming_network_name : '',
      callerName: data.caller_name || '',
      callerType: data.caller_type || '',
      requestPrice: data.request_price || '',
      remainingBalance: data.remaining_balance || '',
    },
  ];
};

module.exports = {
  key: 'number_insight',
  noun: 'Number',
  display: {
    label: 'Number Insight Lookup',
    description:
      'Look up real-time intelligence on a phone number — validity, carrier, reachability, and roaming status.',
  },
  operation: {
    inputFields: [
      {
        key: 'number',
        label: 'Phone Number',
        type: 'string',
        required: true,
        helpText:
          'Number to look up. Accepts E.164 format or local format combined with the Country Code field.',
      },
      {
        key: 'level',
        label: 'Insight Level',
        type: 'string',
        required: false,
        default: 'standard',
        choices: ['basic', 'standard', 'advanced'],
      },
      {
        key: 'countryCode',
        label: 'Country Code (optional)',
        type: 'string',
        required: false,
        helpText: 'ISO 3166-1 alpha-2 code (e.g. `US`, `GB`) — helps parse local format numbers.',
      },
      {
        key: 'cnam',
        label: 'CNAM Lookup (Standard/Advanced)',
        type: 'boolean',
        required: false,
        default: 'false',
        helpText: 'Request caller name information (US numbers only, extra cost).',
      },
    ],
    perform,
    sample: {
      number: '14155552671',
      nationalNumber: '(415) 555-2671',
      countryCode: 'US',
      countryName: 'United States of America',
      currentCarrierName: 'Verizon Wireless',
      currentCarrierNetworkType: 'mobile',
      validNumber: 'valid',
      reachable: 'reachable',
    },
  },
};
