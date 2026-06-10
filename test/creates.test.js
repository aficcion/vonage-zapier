'use strict';

const zapier = require('zapier-platform-core');
const App = require('../index');

const appTester = zapier.createAppTester(App);
zapier.tools.env.inject();

const AUTH = {
  apiKey: process.env.VONAGE_API_KEY || 'test_key',
  apiSecret: process.env.VONAGE_API_SECRET || 'test_secret',
  applicationId: process.env.VONAGE_APP_ID || '',
  privateKey: process.env.VONAGE_PRIVATE_KEY || '',
};

describe('session auth shape', () => {
  test('is session auth with only apiKey/apiSecret visible fields', () => {
    expect(App.authentication.type).toBe('session');
    const fieldKeys = App.authentication.fields.map((f) => f.key);
    expect(fieldKeys).toEqual(['apiKey', 'apiSecret']);
    expect(typeof App.authentication.sessionConfig.perform).toBe('function');
  });

  test('afterResponse refresh middleware is wired', () => {
    expect(App.afterResponse.length).toBeGreaterThan(0);
  });
});

describe('authentication', () => {
  test('test auth returns balance', async () => {
    const bundle = { authData: AUTH };
    if (!process.env.VONAGE_API_KEY) {
      console.log('Skipping live auth test — set VONAGE_API_KEY to run');
      return;
    }
    const result = await appTester(App.authentication.test, bundle);
    expect(result).toHaveProperty('balance');
  });
});

describe('send_sms', () => {
  test('has correct key and noun', () => {
    expect(App.creates.send_sms.key).toBe('send_sms');
    expect(App.creates.send_sms.noun).toBe('SMS');
  });

  test('has required inputFields (from, to, text)', () => {
    const fields = App.creates.send_sms.operation.inputFields.map((f) => f.key);
    expect(fields).toContain('from');
    expect(fields).toContain('to');
    expect(fields).toContain('text');
  });
});

describe('send_message', () => {
  test('supports all channels', () => {
    const channelField = App.creates.send_message.operation.inputFields.find(
      (f) => f.key === 'channel'
    );
    const values = channelField.choices;
    expect(values).toContain('sms');
    expect(values).toContain('whatsapp');
    expect(values).toContain('rcs');
    expect(values).toContain('viber_service');
  });
});

describe('make_call', () => {
  test('has correct key and ttsText field', () => {
    expect(App.creates.make_call.key).toBe('make_call');
    const fields = App.creates.make_call.operation.inputFields.map((f) => f.key);
    expect(fields).toContain('ttsText');
    expect(fields).toContain('recordCall');
    expect(fields).toContain('machineDetection');
  });
});

describe('send_verify', () => {
  test('has correct channels', () => {
    const channelField = App.creates.send_verify.operation.inputFields.find(
      (f) => f.key === 'channel'
    );
    const values = channelField.choices;
    expect(values).toContain('sms');
    expect(values).toContain('whatsapp');
    expect(values).toContain('voice');
    expect(values).toContain('email');
    expect(values).toContain('silent_auth');
  });
});

describe('check_verify', () => {
  test('has requestId and code fields', () => {
    const fields = App.creates.check_verify.operation.inputFields.map((f) => f.key);
    expect(fields).toContain('requestId');
    expect(fields).toContain('code');
  });
});

describe('number_insight search', () => {
  test('has correct insight levels', () => {
    const levelField = App.searches.number_insight.operation.inputFields.find(
      (f) => f.key === 'level'
    );
    const values = levelField.choices;
    expect(values).toContain('basic');
    expect(values).toContain('standard');
    expect(values).toContain('advanced');
  });
});
