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
  test('is session auth with Managed + optional Advanced fields', () => {
    expect(App.authentication.type).toBe('session');
    const fieldKeys = App.authentication.fields.map((f) => f.key);
    expect(fieldKeys).toEqual(['apiKey', 'apiSecret', 'appId', 'appPrivateKey', 'signatureSecret']);
    expect(typeof App.authentication.sessionConfig.perform).toBe('function');
  });

  test('afterResponse refresh middleware is wired', () => {
    expect(App.afterResponse.length).toBeGreaterThan(0);
  });
});

describe('Advanced (bring-your-own-app) auth', () => {
  test('Advanced inputs are optional and the private key is masked', () => {
    const fields = Object.fromEntries(
      App.authentication.fields.map((f) => [f.key, f])
    );
    expect(fields.appId.required).toBeFalsy();
    expect(fields.appPrivateKey.required).toBeFalsy();
    expect(fields.appPrivateKey.type).toBe('password');
  });

  test('session exchange uses the supplied app/key as-is (no app provisioning)', async () => {
    const pem =
      '-----BEGIN PRIVATE KEY-----\nMIIBVQIBADANBgkqhkiG9w0BAQEFAASCAT8=\n-----END PRIVATE KEY-----';
    const bundle = {
      authData: {
        apiKey: 'k',
        apiSecret: 's',
        appId: 'my-own-app-id',
        appPrivateKey: pem,
      },
    };
    const result = await appTester(App.authentication.sessionConfig.perform, bundle);
    expect(result.applicationId).toBe('my-own-app-id');
    expect(result.privateKey).toContain('PRIVATE KEY');
  });
});

describe('authentication', () => {
  test('live: test auth returns balance', async () => {
    // Live test — gated behind RUN_LIVE_TESTS so the default `npx jest` stays a
    // pure unit run (no network, no real credentials needed).
    if (!process.env.RUN_LIVE_TESTS) {
      console.log('Skipping live auth test — set RUN_LIVE_TESTS=1 to run');
      return;
    }
    const bundle = { authData: AUTH };
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
  test('message_status trigger is registered as a hook', () => {
    expect(App.triggers.message_status).toBeDefined();
    expect(App.triggers.message_status.operation.type).toBe('hook');
  });

  test('the legacy SMS API triggers are gone (superseded by the Messages API)', () => {
    expect(App.triggers.inbound_sms).toBeUndefined();
    expect(App.triggers.delivery_receipt).toBeUndefined();
  });

  test('hook triggers expose the takeOver field', () => {
    ['call_status', 'message_status',
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
    expect(cardFields).toEqual(['cardMediaUrl', 'cardTitle', 'cardText', 'cardMediaHeight', 'cardButtonCount', 'buttonOrder']);
    // Picking N buttons reveals N blocks of button fields, and each block
    // only shows the fields for its button type (reply by default).
    const with2 = dynFns[1](null, { inputData: { channel: 'rcs', messageType: 'card', cardButtonCount: 2 } }).map((f) => f.key);
    expect(with2).toContain('btn1Type');
    expect(with2).toContain('btn2Text');
    expect(with2).not.toContain('btn2Phone');
    expect(with2).not.toContain('btn3Type');
    const typed = dynFns[1](null, {
      inputData: { channel: 'rcs', messageType: 'card', cardButtonCount: 2, btn1Type: 'open_url', btn2Type: 'dial' },
    }).map((f) => f.key);
    expect(typed).toContain('btn1Url');
    expect(typed).not.toContain('btn1Phone');
    expect(typed).toContain('btn2Phone');
    expect(typed).not.toContain('btn2Url');
  });

  test('RCS carousel shows N card blocks, each with its optional button fields', () => {
    const dynFns = App.creates.send_message.operation.inputFields.filter(
      (f) => typeof f === 'function'
    );
    const mtForRcs = dynFns[0](null, { inputData: { channel: 'rcs' } });
    expect(mtForRcs.choices).toContain('carousel');
    // Default: 2 cards, no button fields until a button type is picked.
    const base = dynFns[1](null, { inputData: { channel: 'rcs', messageType: 'carousel' } }).map((f) => f.key);
    expect(base).toContain('carouselCardWidth');
    expect(base).toContain('crd1MediaUrl');
    expect(base).toContain('crd2BtnType');
    expect(base).not.toContain('crd1BtnText');
    expect(base).not.toContain('crd3MediaUrl');
    // 3 cards, card 1 with open_url button, card 2 with dial, card 3 none.
    const typed = dynFns[1](null, {
      inputData: { channel: 'rcs', messageType: 'carousel', carouselCardCount: 3, crd1BtnType: 'open_url', crd2BtnType: 'dial' },
    }).map((f) => f.key);
    expect(typed).toContain('crd3MediaUrl');
    expect(typed).toContain('crd1BtnUrl');
    expect(typed).not.toContain('crd1BtnPhone');
    expect(typed).toContain('crd2BtnPhone');
    expect(typed).not.toContain('crd3BtnText');
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

describe('get_balance search', () => {
  test('is registered with optional threshold field', () => {
    expect(App.searches.get_balance.key).toBe('get_balance');
    expect(App.searches.get_balance.operation.inputFields.map((f) => f.key)).toEqual(['threshold']);
  });

  test('live: returns the account balance', async () => {
    // Live test — gated behind RUN_LIVE_TESTS (skipped by default).
    if (!process.env.RUN_LIVE_TESTS) {
      console.log('Skipping live balance test — set RUN_LIVE_TESTS=1 to run');
      return;
    }
    const bundle = { authData: AUTH, inputData: {} };
    const results = await appTester(
      App.searches.get_balance.operation.perform,
      bundle
    );
    expect(results).toHaveLength(1);
    expect(typeof results[0].balance).toBe('number');
    expect(results[0].currency).toBe('EUR');
  });
});

describe('v1.2 fixes', () => {
  test('send_verify no longer exposes the broken callbackUrl field', () => {
    const fields = App.creates.send_verify.operation.inputFields.map((f) => f.key);
    expect(fields).not.toContain('callbackUrl');
  });

  test('isForeignUrl treats placeholders as free slots', () => {
    const { isForeignUrl } = require('../app_webhooks');
    expect(isForeignUrl('http://example.com', '')).toBe(false);
    expect(isForeignUrl('https://www.example.org/webhook', '')).toBe(false);
    expect(isForeignUrl('https://nexmo-community.github.io/ncco-examples/talk.json', '')).toBe(false);
    expect(isForeignUrl('https://hooks.zapier.com/abc', '')).toBe(false);
    expect(isForeignUrl('https://my-crm.io/webhook', '')).toBe(true);
  });

  test('401 on a chat-channel send throws a product error, not RefreshAuthError', () => {
    const { refreshOnInvalidJwt } = require('../jwt_middleware');
    class FakeError extends Error {}
    class FakeRefresh extends Error {}
    const z = { errors: { Error: FakeError, RefreshAuthError: FakeRefresh } };
    const chat401 = {
      status: 401,
      request: {
        headers: {
          Authorization: 'Bearer x',
          'X-Connector-Chat-Channel': 'whatsapp',
        },
      },
    };
    expect(() => refreshOnInvalidJwt(chat401, z, {})).toThrow(FakeError);
    expect(() => refreshOnInvalidJwt(chat401, z, {})).toThrow(/whatsapp/);

    const plain401 = {
      status: 401,
      request: { headers: { Authorization: 'Bearer x' } },
    };
    expect(() => refreshOnInvalidJwt(plain401, z, {})).toThrow(FakeRefresh);
  });
});

describe('v1.5 — named channel sends (Send WhatsApp / Send RCS)', () => {
  test('send_whatsapp and send_rcs are registered with the right keys and nouns', () => {
    expect(App.creates.send_whatsapp).toBeDefined();
    expect(App.creates.send_whatsapp.key).toBe('send_whatsapp');
    expect(App.creates.send_whatsapp.noun).toBe('WhatsApp Message');
    expect(App.creates.send_rcs).toBeDefined();
    expect(App.creates.send_rcs.key).toBe('send_rcs');
    expect(App.creates.send_rcs.noun).toBe('RCS Message');
  });

  test('the multi-channel send is NOT removed (additive, not a replacement)', () => {
    expect(App.creates.send_message).toBeDefined();
    expect(App.creates.send_message.key).toBe('send_message');
  });

  test('both expose To, From (dynamic senders) and a fixed Message Type field — no Channel field', () => {
    ['send_whatsapp', 'send_rcs'].forEach((key) => {
      const fields = App.creates[key].operation.inputFields;
      const staticKeys = fields
        .filter((f) => typeof f === 'object')
        .map((f) => f.key);
      expect(staticKeys).toContain('to');
      expect(staticKeys).toContain('from');
      expect(staticKeys).toContain('messageType');
      expect(staticKeys).not.toContain('channel'); // channel is fixed
      const from = fields.find((f) => typeof f === 'object' && f.key === 'from');
      expect(from.dynamic).toBe('list_senders.id.label');
    });
  });

  test('completeness: Send WhatsApp offers template; Send RCS offers card and carousel', () => {
    const waType = App.creates.send_whatsapp.operation.inputFields.find(
      (f) => typeof f === 'object' && f.key === 'messageType'
    );
    expect(waType.choices).toContain('text');
    expect(waType.choices).toContain('image');
    expect(waType.choices).toContain('template');

    const rcsType = App.creates.send_rcs.operation.inputFields.find(
      (f) => typeof f === 'object' && f.key === 'messageType'
    );
    expect(rcsType.choices).toContain('card');
    expect(rcsType.choices).toContain('carousel');
  });

  test('content fields follow the fixed channel (RCS reveals card fields, WhatsApp keeps caption)', () => {
    const rcsContent = App.creates.send_rcs.operation.inputFields.find(
      (f) => typeof f === 'function'
    );
    const cardFields = rcsContent(null, { inputData: { messageType: 'card' } }).map((f) => f.key);
    expect(cardFields).toContain('cardMediaUrl');
    expect(cardFields).toContain('cardButtonCount');

    const waContent = App.creates.send_whatsapp.operation.inputFields.find(
      (f) => typeof f === 'function'
    );
    const waImg = waContent(null, { inputData: { messageType: 'image' } }).map((f) => f.key);
    expect(waImg).toContain('imageCaption'); // WhatsApp supports image caption
  });
});

describe('v1.5 — API Request passthrough', () => {
  test('is registered and exposes method, url and auth', () => {
    expect(App.creates.api_request).toBeDefined();
    expect(App.creates.api_request.key).toBe('api_request');
    const fields = App.creates.api_request.operation.inputFields.map((f) => f.key);
    expect(fields).toContain('method');
    expect(fields).toContain('url');
    expect(fields).toContain('auth');
  });

  test('url is required, auth defaults to jwt, method defaults to GET', () => {
    const fields = Object.fromEntries(
      App.creates.api_request.operation.inputFields.map((f) => [f.key, f])
    );
    expect(fields.url.required).toBe(true);
    expect(fields.auth.default).toBe('jwt');
    expect(fields.method.default).toBe('GET');
    expect(fields.auth.choices).toEqual(['jwt', 'basic']);
  });
});

describe('v1.5 — buildMessagePayload (shared engine)', () => {
  const { buildMessagePayload } = require('../creates/_channel_send');

  test('whatsapp template builds the template block', () => {
    const p = buildMessagePayload({
      channel: 'whatsapp',
      messageType: 'template',
      to: '+1 555 987 6543',
      from: 'MyBrand',
      templateName: 'welcome',
      templateLanguage: 'en_US',
    });
    expect(p.channel).toBe('whatsapp');
    expect(p.message_type).toBe('template');
    expect(p.template.name).toBe('welcome');
    expect(p.template.language.code).toBe('en_US');
    expect(p.to).toBe('15559876543'); // normalised
  });

  test('rcs card builds a custom richCard standaloneCard', () => {
    const p = buildMessagePayload({
      channel: 'rcs',
      messageType: 'card',
      to: '15559876543',
      from: 'agent-id',
      cardMediaUrl: 'https://example.com/photo.jpg',
      cardTitle: 'Hello',
      cardText: 'Body text',
    });
    expect(p.message_type).toBe('custom');
    const card = p.custom.contentMessage.richCard.standaloneCard;
    expect(card).toBeDefined();
    expect(card.cardContent.media.contentInfo.fileUrl).toBe('https://example.com/photo.jpg');
    expect(card.cardContent.title).toBe('Hello');
  });

  test('rcs carousel builds a custom richCard carouselCard with N cards', () => {
    const p = buildMessagePayload({
      channel: 'rcs',
      messageType: 'carousel',
      to: '15559876543',
      from: 'agent-id',
      carouselCardCount: 3,
      crd1MediaUrl: 'https://example.com/1.jpg',
      crd2MediaUrl: 'https://example.com/2.jpg',
      crd3MediaUrl: 'https://example.com/3.jpg',
    });
    expect(p.message_type).toBe('custom');
    const carousel = p.custom.contentMessage.richCard.carouselCard;
    expect(carousel).toBeDefined();
    expect(carousel.cardContents).toHaveLength(3);
    expect(carousel.cardContents[0].media.contentInfo.fileUrl).toBe('https://example.com/1.jpg');
  });
});

describe('v1.6 — chat-channel error mapping (Fix 1)', () => {
  const { sendVia } = require('../creates/_channel_send');
  class FakeError extends Error {}

  const makeZ = (status, json) => ({
    errors: { Error: FakeError },
    request: async () => ({ status, json }),
  });
  const bundle = (over = {}) => ({
    authData: { _jwt: 'x' },
    inputData: {
      from: 'agent',
      to: '34622293256',
      messageType: 'card',
      cardMediaUrl: 'https://example.com/y.jpg',
      ...over,
    },
  });

  const messageOf = async (z, channel, over) => {
    try {
      await sendVia(z, bundle(over), channel);
      return null;
    } catch (e) {
      return e.message;
    }
  };

  test('422 on a chat channel surfaces the Vonage detail, NOT "isn\'t registered"', async () => {
    const z = makeZ(422, { title: 'Invalid params' });
    const msg = await messageOf(z, 'rcs');
    expect(msg).toContain('Vonage rcs error: Invalid params');
    expect(msg).not.toMatch(/isn't registered/);
  });

  test('429 on a chat channel also surfaces the real detail, not the sender message', async () => {
    const z = makeZ(429, { detail: 'Rate limit exceeded' });
    const msg = await messageOf(z, 'whatsapp');
    expect(msg).toContain('Vonage whatsapp error: Rate limit exceeded');
    expect(msg).not.toMatch(/isn't registered/);
  });

  test('401/403 on a chat channel still gives the sender-not-registered guidance', async () => {
    const m401 = await messageOf(makeZ(401, { title: 'Unauthorized' }), 'whatsapp');
    expect(m401).toMatch(/isn't registered/);
    expect(m401).toContain('Vonage said: Unauthorized');

    const m403 = await messageOf(makeZ(403, { detail: 'Forbidden' }), 'whatsapp');
    expect(m403).toMatch(/isn't registered/);
  });

  test('a non-chat channel (sms) 4xx uses the generic Messages API error', async () => {
    const msg = await messageOf(makeZ(400, { title: 'Bad Request' }), 'sms', {
      messageType: 'text',
      text: 'hi',
    });
    expect(msg).toContain('Messages API error: Bad Request');
  });
});

describe('v1.6 — content fields are robust to a stale message type (Fix 2)', () => {
  const { contentFields, contentFieldsFor, messageTypeField } = require('../creates/_channel_send');

  test("computeContentFields('sms', {messageType: 'card'}) returns the text field (fallback)", () => {
    // via the fixed-channel helper (closure)
    const fixed = contentFieldsFor('sms')(null, { inputData: { messageType: 'card' } }).map((f) => f.key);
    expect(fixed).toEqual(['text']);
    // via the multi-channel dynamic function (channel from input)
    const multi = contentFields(null, { inputData: { channel: 'sms', messageType: 'card' } }).map((f) => f.key);
    expect(multi).toEqual(['text']);
  });

  test('whatsapp with a stale RCS-only type (carousel) falls back to text', () => {
    const f = contentFields(null, { inputData: { channel: 'whatsapp', messageType: 'carousel' } }).map((x) => x.key);
    expect(f).toEqual(['text']);
  });

  test('a still-valid stored type is preserved (rcs + card → card fields)', () => {
    const f = contentFields(null, { inputData: { channel: 'rcs', messageType: 'card' } }).map((x) => x.key);
    expect(f).toContain('cardMediaUrl');
  });

  test('Message Type default self-corrects when the channel no longer supports the stored type', () => {
    const f = messageTypeField(null, { inputData: { channel: 'sms', messageType: 'card' } });
    expect(f.choices).toEqual(['text']);
    expect(f.default).toBe('text'); // not the stale 'card'
  });
});

describe('v1.7 — Readiness Gate (Security / Compliance / BI / Consent)', () => {
  class FakeError extends Error {}
  const z = { errors: { Error: FakeError }, console: { log: () => {} } };

  // SC-03 — connection exposes an optional signatureSecret (masked).
  test('SC-03: auth has an optional masked signatureSecret field', () => {
    const fields = Object.fromEntries(App.authentication.fields.map((f) => [f.key, f]));
    expect(fields.signatureSecret).toBeDefined();
    expect(fields.signatureSecret.required).toBeFalsy();
    expect(fields.signatureSecret.type).toBe('password');
  });

  // SC-02 — verify_event must NOT emit the OTP.
  test('SC-02: verify_event output omits submittedCode', () => {
    const out = App.triggers.verify_event.operation.perform(z, {
      inputData: { eventTypes: 'completed,failed' },
      authData: {},
      cleanedRequest: {
        request_id: 'r1', status: 'completed', type: 'event',
        submitted_code: '1234', channel: 'sms',
      },
    })[0];
    expect(out).not.toHaveProperty('submittedCode');
    expect(JSON.stringify(out)).not.toContain('1234');
    expect(out.requestId).toBe('r1');
    // sample/outputFields must not leak it either
    expect(App.triggers.verify_event.operation.sample).not.toHaveProperty('submittedCode');
  });

  // SC-03 — verifyWebhookSignature behaviour.
  describe('SC-03: verifyWebhookSignature', () => {
    const { verifyWebhookSignature } = require('../verify_webhook');
    const jwt = require('jsonwebtoken');
    const SECRET = 'super-secret-signing-key';

    test('no Signature Secret → no-op (does not throw, even without a token)', () => {
      expect(() =>
        verifyWebhookSignature(z, { authData: {}, rawRequest: { headers: {} } })
      ).not.toThrow();
    });

    test('valid HS256 token signed with the secret passes', () => {
      const token = jwt.sign({ iat: Math.floor(Date.now() / 1000) }, SECRET, { algorithm: 'HS256' });
      expect(() =>
        verifyWebhookSignature(z, {
          authData: { signatureSecret: SECRET },
          rawRequest: { headers: { Authorization: `Bearer ${token}` } },
        })
      ).not.toThrow();
    });

    test('a forged/invalid token throws', () => {
      const bad = jwt.sign({}, 'a-different-secret', { algorithm: 'HS256' });
      expect(() =>
        verifyWebhookSignature(z, {
          authData: { signatureSecret: SECRET },
          rawRequest: { headers: { authorization: `Bearer ${bad}` } },
        })
      ).toThrow(FakeError);
    });

    test('secret set but no token throws', () => {
      expect(() =>
        verifyWebhookSignature(z, { authData: { signatureSecret: SECRET }, rawRequest: { headers: {} } })
      ).toThrow(FakeError);
    });

    test('hook triggers still fire with no Signature Secret set', () => {
      const out = App.triggers.message_status.operation.perform(z, {
        inputData: { statuses: 'delivered,failed' },
        authData: {},
        rawRequest: { headers: {} },
        cleanedRequest: { message_uuid: 'm1', status: 'delivered', to: 't', from: 'f', channel: 'sms' },
      });
      expect(out).toHaveLength(1);
      expect(out[0].messageUuid).toBe('m1');
    });
  });

  // SC-04 — api_request anti-SSRF allowlist.
  describe('SC-04: api_request host allowlist', () => {
    const perform = App.creates.api_request.operation.perform;
    const baseBundle = (url) => ({ authData: { _jwt: 'x' }, inputData: { url, auth: 'jwt' } });

    test('rejects a non-Vonage host', async () => {
      await expect(perform(z, baseBundle('https://evil.example.com/steal'))).rejects.toThrow(FakeError);
      let msg = '';
      try { await perform(z, baseBundle('http://169.254.169.254/latest/meta-data')); } catch (e) { msg = e.message; }
      expect(msg).toMatch(/only call Vonage hosts/i);
    });

    test('rejects a look-alike host (suffix trick)', async () => {
      await expect(perform(z, baseBundle('https://api.nexmo.com.evil.com/x'))).rejects.toThrow(FakeError);
    });

    test('accepts api.nexmo.com (passes the allowlist, then makes the request)', async () => {
      const zMock = {
        errors: { Error: FakeError },
        console: { log: () => {} },
        request: async () => ({ status: 200, json: { ok: true }, headers: { entries: () => [] } }),
      };
      const res = await perform(zMock, baseBundle('https://api.nexmo.com/v1/messages'));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });
  });

  // SC-05 — invalid Template Components JSON throws a clear, field-named error.
  test('SC-05: invalid templateComponents throws a clear error (no raw SyntaxError leak)', () => {
    const { buildMessagePayload } = require('../creates/_channel_send');
    expect(() =>
      buildMessagePayload({
        channel: 'whatsapp', messageType: 'template', to: '1', from: 'B',
        templateName: 'welcome', templateComponents: '{not valid',
      })
    ).toThrow(/"Template Components \(JSON\)" field isn't valid JSON/);
  });

  // PT-01 / PT-02 — BI attribution tag.
  describe('PT-01/PT-02: client_ref = connector-zapier', () => {
    const { buildMessagePayload } = require('../creates/_channel_send');
    test('unified/named send payload tags client_ref', () => {
      const p = buildMessagePayload({ channel: 'sms', messageType: 'text', to: '1', from: 'B', text: 'hi' });
      expect(p.client_ref).toBe('connector-zapier');
    });
    test('send_sms perform tags client_ref', async () => {
      let sent;
      const zMock = {
        errors: { Error: FakeError },
        request: async (req) => { sent = req; return { status: 202, json: { message_uuid: 'u' } }; },
      };
      await App.creates.send_sms.operation.perform(zMock, {
        authData: { _jwt: 'x' }, inputData: { from: 'B', to: '1', text: 'hi' },
      });
      expect(sent.body.client_ref).toBe('connector-zapier');
    });
    test('send_verify defaults client_ref when the maker leaves it blank', async () => {
      let sent;
      const zMock = {
        errors: { Error: FakeError },
        request: async (req) => { sent = req; return { status: 202, json: { request_id: 'r' } }; },
      };
      await App.creates.send_verify.operation.perform(zMock, {
        authData: { _jwt: 'x' }, inputData: { brand: 'Acme', to: '15551234567', channel: 'sms' },
      });
      expect(sent.body.client_ref).toBe('connector-zapier');
    });
  });

  // CM-01 — consent flags on inbound_message.
  test('CM-01: inbound_message flags isOptOut for "STOP" and isOptIn for "START"', () => {
    const run = (text) => App.triggers.inbound_message.operation.perform(z, {
      inputData: {}, authData: {}, rawRequest: { headers: {} },
      cleanedRequest: { message_uuid: 'm', from: 'f', to: 't', text },
    })[0];
    const stop = run('  stop ');
    expect(stop.isOptOut).toBe(true);
    expect(stop.isOptIn).toBe(false);
    const start = run('START');
    expect(start.isOptIn).toBe(true);
    expect(start.isOptOut).toBe(false);
    const normal = run('hello there');
    expect(normal.isOptOut).toBe(false);
    expect(normal.isOptIn).toBe(false);
  });
});

describe('v1.8 — card/button order lists (structural editing)', () => {
  const { buildMessagePayload, parseOrder, CONTENT_FIELDS } = require('../creates/_channel_send');

  const carousel = (extra) => buildMessagePayload({
    channel: 'rcs',
    messageType: 'carousel',
    to: '15559876543',
    from: 'agent-id',
    carouselCardCount: 5,
    crd1MediaUrl: 'https://example.com/1.jpg',
    crd2MediaUrl: 'https://example.com/2.jpg',
    crd3MediaUrl: 'https://example.com/3.jpg',
    crd4MediaUrl: 'https://example.com/4.jpg',
    crd5MediaUrl: 'https://example.com/5.jpg',
    ...extra,
  });

  const urls = (p) =>
    p.custom.contentMessage.richCard.carouselCard.cardContents.map(
      (c) => c.media.contentInfo.fileUrl
    );

  test('parseOrder falls back to the natural 1..N order when blank or absent', () => {
    expect(parseOrder(undefined, 3, 'Card Order')).toEqual([1, 2, 3]);
    expect(parseOrder('', 3, 'Card Order')).toEqual([1, 2, 3]);
    expect(parseOrder('   ', 3, 'Card Order')).toEqual([1, 2, 3]);
  });

  test('parseOrder tolerates spacing and keeps deliberate repeats', () => {
    expect(parseOrder(' 1 , 3,3 ', 3, 'Card Order')).toEqual([1, 3, 3]);
  });

  test('parseOrder rejects out-of-range and non-numeric slots by field name', () => {
    expect(() => parseOrder('1,9', 5, 'Card Order')).toThrow(/"Card Order".*"9".*between 1 and 5/);
    expect(() => parseOrder('1,two', 5, 'Card Order')).toThrow(/"two"/);
    expect(() => parseOrder('0,1', 5, 'Card Order')).toThrow(/"0"/);
  });

  test('an omitted card is dropped without disturbing the ones after it', () => {
    // The whole point: deleting card 2 of 5 must not renumber 3, 4 and 5.
    expect(urls(carousel({ cardOrder: '1,3,4,5' }))).toEqual([
      'https://example.com/1.jpg',
      'https://example.com/3.jpg',
      'https://example.com/4.jpg',
      'https://example.com/5.jpg',
    ]);
  });

  test('cards can be reordered and duplicated from the order list alone', () => {
    expect(urls(carousel({ cardOrder: '4,1,2,3,5' }))[0]).toBe('https://example.com/4.jpg');
    expect(urls(carousel({ cardOrder: '1,3,3,4' }))).toEqual([
      'https://example.com/1.jpg',
      'https://example.com/3.jpg',
      'https://example.com/3.jpg',
      'https://example.com/4.jpg',
    ]);
  });

  test('a blank order still sends every card, unchanged from before', () => {
    expect(urls(carousel({}))).toHaveLength(5);
    expect(urls(carousel({ cardOrder: '' }))).toHaveLength(5);
  });

  test('an order that leaves fewer than 2 cards is refused with a clear message', () => {
    expect(() => carousel({ cardOrder: '2' })).toThrow(/between 2 and 10 cards.*resolves to 1/);
  });

  test('card buttons honour their own order list', () => {
    const p = buildMessagePayload({
      channel: 'rcs',
      messageType: 'card',
      to: '15559876543',
      from: 'agent-id',
      cardMediaUrl: 'https://example.com/photo.jpg',
      cardButtonCount: 3,
      btn1Text: 'Yes', btn2Text: 'Maybe', btn3Text: 'No',
      buttonOrder: '3,1',
    });
    const chips = p.custom.contentMessage.richCard.standaloneCard.cardContent.suggestions;
    expect(chips.map((c) => c.reply.text)).toEqual(['No', 'Yes']);
  });

  test('the order fields are offered but never required, and do not re-render the form', () => {
    const order = CONTENT_FIELDS.carousel.find((f) => f.key === 'cardOrder');
    expect(order.required).toBe(false);
    // Re-rendering here would add a "Refresh fields" round trip for no gain:
    // the order list changes what is sent, never which fields are shown.
    expect(order.altersDynamicFields).toBeUndefined();
    expect(CONTENT_FIELDS.card.find((f) => f.key === 'buttonOrder').altersDynamicFields).toBeUndefined();
  });
});
