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

  test('From field uses the dynamic numbers dropdown', () => {
    const from = App.creates.send_sms.operation.inputFields.find(
      (f) => f.key === 'from'
    );
    expect(from.dynamic).toBe('list_numbers.id.label');
  });
});

describe('hidden From-dropdown triggers', () => {
  test('list_numbers and list_senders are registered and hidden', () => {
    expect(App.triggers.list_numbers).toBeDefined();
    expect(App.triggers.list_numbers.display.hidden).toBe(true);
    expect(App.triggers.list_senders).toBeDefined();
    expect(App.triggers.list_senders.display.hidden).toBe(true);
  });
});

describe('phone normalization', () => {
  const { normalizePhone } = require('../phone');
  test('strips +, spaces, dashes and parens from numbers', () => {
    expect(normalizePhone('+34 622 293 256')).toBe('34622293256');
    expect(normalizePhone('+1 (415) 738-6102')).toBe('14157386102');
    expect(normalizePhone('447418348162')).toBe('447418348162');
  });
  test('leaves alphanumeric senders, agent ids and emails untouched', () => {
    expect(normalizePhone('MyBrand')).toBe('MyBrand');
    expect(normalizePhone('carlos')).toBe('carlos');
    expect(normalizePhone('user@example.com')).toBe('user@example.com');
  });
});

describe('Session 3 — recepción y bordes', () => {
  test('delivery_receipt trigger is registered as a hook', () => {
    expect(App.triggers.delivery_receipt).toBeDefined();
    expect(App.triggers.delivery_receipt.operation.type).toBe('hook');
  });

  test('hook triggers expose the takeOver field', () => {
    ['inbound_sms', 'delivery_receipt', 'call_status', 'message_status',
      'verify_event', 'inbound_call', 'inbound_message'].forEach((key) => {
      const fields = App.triggers[key].operation.inputFields.map((f) => f.key);
      expect(fields).toContain('takeOver');
    });
  });

  test('isForeignUrl protects only foreign URLs', () => {
    const { isForeignUrl } = require('../app_webhooks');
    expect(isForeignUrl('https://hooks.zapier.com/abc', '')).toBe(false);
    expect(isForeignUrl('', '')).toBe(false);
    expect(isForeignUrl('https://mine.example.com/x', 'https://mine.example.com/x')).toBe(false);
    expect(isForeignUrl('https://someone-else.com/hook', '')).toBe(true);
  });

  test('Send SMS and Send Message offer a sandbox toggle', () => {
    expect(App.creates.send_sms.operation.inputFields.map((f) => f.key)).toContain('sandbox');
    expect(App.creates.send_message.operation.inputFields.map((f) => f.key)).toContain('sandbox');
  });
});

describe('send_message', () => {
  test('supports all channels', () => {
    const channelField = App.creates.send_message.operation.inputFields.find(
      (f) => typeof f === 'object' && f.key === 'channel'
    );
    const values = channelField.choices;
    expect(values).toContain('sms');
    expect(values).toContain('whatsapp');
    expect(values).toContain('rcs');
    expect(values).toContain('viber_service');
  });

  test('Message Type choices depend on the channel', () => {
    const dynFns = App.creates.send_message.operation.inputFields.filter(
      (f) => typeof f === 'function'
    );
    // First dynamic function is the Message Type field.
    const mtForSms = dynFns[0](null, { inputData: { channel: 'sms' } });
    expect(mtForSms.choices).toEqual(['text']);
    const mtForWa = dynFns[0](null, { inputData: { channel: 'whatsapp' } });
    expect(mtForWa.choices).toContain('template');
    expect(mtForWa.choices).toContain('image');
  });

  test('only the content fields for the chosen message type are shown', () => {
    const dynFns = App.creates.send_message.operation.inputFields.filter(
      (f) => typeof f === 'function'
    );
    const contentFn = dynFns[1];
    const textFields = contentFn(null, { inputData: { messageType: 'text' } }).map((f) => f.key);
    expect(textFields).toEqual(['text']);
    const imgFields = contentFn(null, { inputData: { channel: 'whatsapp', messageType: 'image' } }).map((f) => f.key);
    expect(imgFields).toEqual(['imageUrl', 'imageCaption']);
    const tplFields = contentFn(null, { inputData: { messageType: 'template' } }).map((f) => f.key);
    expect(tplFields).toContain('templateName');
  });

  test('RCS offers the Rich Card type with its fields; other channels do not', () => {
    const dynFns = App.creates.send_message.operation.inputFields.filter(
      (f) => typeof f === 'function'
    );
    const mtForRcs = dynFns[0](null, { inputData: { channel: 'rcs' } });
    expect(mtForRcs.choices).toContain('card');
    const mtForWa = dynFns[0](null, { inputData: { channel: 'whatsapp' } });
    expect(mtForWa.choices).not.toContain('card');
    const cardFields = dynFns[1](null, { inputData: { channel: 'rcs', messageType: 'card' } }).map((f) => f.key);
    expect(cardFields).toEqual(['cardMediaUrl', 'cardTitle', 'cardText', 'cardMediaHeight', 'cardButtonCount']);
    // Picking N buttons reveals N blocks of button fields.
    const with2 = dynFns[1](null, { inputData: { channel: 'rcs', messageType: 'card', cardButtonCount: 2 } }).map((f) => f.key);
    expect(with2).toContain('btn1Type');
    expect(with2).toContain('btn2Phone');
    expect(with2).not.toContain('btn3Type');
  });

  test('image caption only appears on channels that support it', () => {
    const dynFns = App.creates.send_message.operation.inputFields.filter(
      (f) => typeof f === 'function'
    );
    const contentFn = dynFns[1];
    const rcsImg = contentFn(null, { inputData: { channel: 'rcs', messageType: 'image' } }).map((f) => f.key);
    expect(rcsImg).toEqual(['imageUrl']); // no caption on RCS
    const waImg = contentFn(null, { inputData: { channel: 'whatsapp', messageType: 'image' } }).map((f) => f.key);
    expect(waImg).toContain('imageCaption');
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
