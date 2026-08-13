/* Phase D E2E: auto-reply (guards, cooldown, office hours), search, porting. */
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const BASE = process.env.E2E_BASE || 'http://localhost:3116';
const TENANT = 'tn_WUzMljSTvH2W';
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});
async function idTokenFor(uid) {
  const t = await admin.auth().createCustomToken(uid);
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t, returnSecureToken: true }) });
  return (await r.json()).idToken;
}
const results = [];
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
async function call(token, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}
(async () => {
  const db = admin.database();
  const tenant = (await db.ref(`apiTenants/${TENANT}`).get()).val();
  const ourNumber = Object.values(tenant.numbers || {}).filter((n) => !n.releasedAt)[0].phoneNumber;
  const ourDigits = ourNumber.replace(/\D/g, '').slice(-10);
  const token = await idTokenFor(tenant.uid);
  const keySecret = require('fs').readFileSync('/tmp/claude-1000/-home-alek-ghost-checkout/fe4037b5-a49e-4d39-8f1f-a1e153d61a8b/scratchpad/qa-key.txt', 'utf8').trim();
  const inbound = (from, body) =>
    fetch(`${BASE}/api/v1/test/inbound`, { method: 'POST', headers: { Authorization: `Bearer ${keySecret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: ourNumber, body }) });
  const thread = async (them) => {
    const ck = `${ourDigits}_${them.replace(/\D/g, '').slice(-10)}`;
    const r = await call(token, `/api/developers/conversations/${ck}?limit=20`);
    return { ck, msgs: r.body.data || [] };
  };

  const A = '+15005550190', B = '+15005550191';

  // enable auto-reply, mode always
  let r = await call(token, '/api/developers/auto-reply', { method: 'PUT', body: JSON.stringify({ number: ourNumber, enabled: true, message: 'Thanks! We reply within the hour.' }) });
  check('auto-reply saved', r.status === 200);

  await inbound(A, 'Hi, is the blue one still available?');
  await new Promise((s) => setTimeout(s, 600));
  let t = await thread(A);
  check('auto-reply fired', t.msgs.some((m) => m.direction === 'outbound' && m.body.includes('within the hour')), t.msgs.map((m)=>m.body).join('|').slice(0,90));

  await inbound(A, 'hello again');
  await new Promise((s) => setTimeout(s, 600));
  t = await thread(A);
  const replies = t.msgs.filter((m) => m.direction === 'outbound' && m.body.includes('within the hour'));
  check('cooldown: no second reply', replies.length === 1, `replies=${replies.length}`);

  await inbound(B, 'Your Ghost code is 123456');
  await new Promise((s) => setTimeout(s, 600));
  t = await thread(B);
  check('verification code NOT auto-replied', !t.msgs.some((m) => m.direction === 'outbound'));

  await inbound(B, 'STOP');
  await new Promise((s) => setTimeout(s, 600));
  t = await thread(B);
  const stopReplies = t.msgs.filter((m) => m.direction === 'outbound');
  check('STOP gets confirmation, not auto-reply', stopReplies.length === 1 && stopReplies[0].body.includes('unsubscribed'));

  await inbound(B, 'random message after stop');
  await new Promise((s) => setTimeout(s, 600));
  t = await thread(B);
  check('opted-out counterparty never auto-replied', t.msgs.filter((m) => m.direction === 'outbound').length === 1);

  // office hours: after_hours mode with hours covering all week -> inside hours -> no reply
  r = await call(token, '/api/developers/auto-reply', { method: 'PUT', body: JSON.stringify({ number: ourNumber, enabled: true, message: 'We are closed.', officeHours: { tz: 'America/New_York', days: [0,1,2,3,4,5,6], start: '00:00', end: '23:59', mode: 'after_hours' } }) });
  const C = '+15005550192';
  await inbound(C, 'anyone there?');
  await new Promise((s) => setTimeout(s, 600));
  t = await thread(C);
  check('after_hours: silent inside hours', !t.msgs.some((m) => m.direction === 'outbound'));

  // search
  r = await call(token, '/api/developers/search?q=blue one');
  check('message search hits', r.status === 200 && r.body.messages.some((m) => m.body.includes('blue one')), `hits=${r.body.messages?.length}`);
  r = await call(token, '/api/developers/search?q=x');
  check('short query 400', r.status === 400);

  // porting
  r = await call(token, '/api/developers/porting', { method: 'POST', body: JSON.stringify({ number: '+14155551234', currentCarrier: 'Verizon', accountNumber: 'ACC-1', pinLast4: '9999', authorizedName: 'QA Admin' }) });
  check('port request created', r.status === 201, JSON.stringify(r.body).slice(0, 80));
  const portId = r.body.request?.id;
  const SECRET = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET; // must match the server the test hits
  const adv = await fetch(`${BASE}/api/admin/port-requests`, { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: TENANT, portId, status: 'submitted', note: 'Filed with carrier' }) });
  check('admin advances status', adv.status === 200);
  r = await call(token, '/api/developers/porting');
  const port = (r.body.requests || []).find((p) => p.id === portId);
  check('customer sees timeline', port?.status === 'submitted' && port.statusLog.length === 2);

  // cleanup (recorded ids)
  await db.ref(`apiAutoReply/${TENANT}/${ourDigits}`).remove();
  for (const them of [A, B, C]) {
    const d = them.replace(/\D/g, '').slice(-10);
    const ck = `${ourDigits}_${d}`;
    await db.ref(`apiConversations/${TENANT}/${ck}`).remove();
    await db.ref(`apiMessages/${TENANT}/byConv/${ck}`).remove();
    await db.ref(`apiAutoReplyState/${TENANT}/${ck}`).remove();
    await db.ref(`apiOptOut/${TENANT}/${d}`).remove();
  }
  if (portId) await db.ref(`apiPortRequests/${TENANT}/${portId}`).remove();
  console.log('cleaned: auto-reply config/state, 3 conversations, opt-out, port request');

  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
