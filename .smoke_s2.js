const zapier = require('/Users/carlos/vonage-zapier/node_modules/zapier-platform-core');
const App = require('/Users/carlos/vonage-zapier/index.js');
const appTester = zapier.createAppTester(App);
zapier.tools.env.inject();

(async () => {
  // 1. Exchange a fresh session (find-or-create app + register key)
  const authBundle = { authData: { apiKey: process.env.VONAGE_API_KEY, apiSecret: process.env.VONAGE_API_SECRET } };
  const session = await appTester(App.authentication.sessionConfig.perform, authBundle);
  const authData = { ...authBundle.authData, ...session };
  console.log('session app:', session.applicationId);

  // 2. list_numbers dropdown
  const numbers = await appTester(App.triggers.list_numbers.operation.perform, { authData });
  console.log('\nlist_numbers ->', numbers.length, 'numbers');
  numbers.forEach(n => console.log('  ', n.label, n.appId ? '(app '+n.appId.slice(0,8)+')' : '(libre)'));

  // 3. list_senders dropdown
  const senders = await appTester(App.triggers.list_senders.operation.perform, { authData });
  console.log('\nlist_senders ->', senders.length, 'senders');
  senders.forEach(s => console.log('  ', s.label));

  // 4. send_sms via Messages API (signed with managed JWT through middleware)
  const smsBundle = { authData, inputData: { from: '447418348162', to: '34622293256', text: 'Sesion 2: Send SMS via Messages API + From dinamico', unicode: false } };
  const sms = await appTester(App.creates.send_sms.operation.perform, smsBundle);
  console.log('\nsend_sms ->', JSON.stringify(sms));
})().catch(e => { console.error('SMOKE FAIL:', e.message); process.exit(1); });
