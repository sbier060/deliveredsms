/* Phase B E2E: inbox, threads, unread, compose, templates, attribution.
 * Sandbox-only on the existing fixture tenant. Cleanup: recorded ids. */
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
  const custom = await admin.auth().createCustomToken(uid);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) });
  const d = await res.json();
  if (!d.idToken) throw new Error('exchange failed');
  return d.idToken;
}

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

async function call(token, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

(async () => {
  const db = admin.database();
  const tenant = (await db.ref(`apiTenants/${TENANT}`).get()).val();
  const ownerUid = tenant.uid;
  const ourNumber = Object.values(tenant.numbers || {}).filter((n) => !n.releasedAt)[0].phoneNumber;
  const THEM = '+15005550177'; // dedicated counterparty for this test
  const token = await idTokenFor(ownerUid);

  // also need a sandbox API key for /v1/test/inbound
  const { mintKey } = { mintKey: null };
  const keySecret = process.env.QA_KEY || require('fs').readFileSync(process.env.QA_KEY_FILE || '/tmp/claude-1000/-home-alek-ghost-checkout/fe4037b5-a49e-4d39-8f1f-a1e153d61a8b/scratchpad/qa-key.txt', 'utf8').trim();

  // contact for merge/name resolution
  await call(token, '/api/developers/contacts', { method: 'POST', body: JSON.stringify({ name: 'Merge Target', phone: THEM, tags: ['phase-b'] }) });

  // template
  let r = await call(token, '/api/developers/templates', { method: 'POST', body: JSON.stringify({ name: 'hi', body: 'Hi {{first_name}}, your table is ready.' }) });
  check('template created', r.status === 201);
  const tplId = r.body.template?.id;

  // signature
  r = await call(token, '/api/developers/team/me', { method: 'PATCH', body: JSON.stringify({ signature: '— QA Bot, Delivered' }) });
  check('signature saved', r.status === 200 && r.body.signature.includes('QA Bot'));

  // console compose with merge + signature
  r = await call(token, '/api/developers/messages/send', { method: 'POST', body: JSON.stringify({ to: THEM, from: ourNumber, body: 'Hi {{first_name}}!' }) });
  check('console send 201', r.status === 201, JSON.stringify(r.body).slice(0, 120));
  check('merge resolved', r.body.message?.body?.startsWith('Hi Merge!'));
  check('signature appended', r.body.message?.body?.includes('— QA Bot, Delivered'));
  check('attribution stamped', typeof r.body.message?.sent_by === 'string' && r.body.message.sent_by.length > 0, r.body.message?.sent_by);

  // inbound reply -> conversation unread
  const inb = await fetch(`${BASE}/api/v1/test/inbound`, { method: 'POST', headers: { Authorization: `Bearer ${keySecret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: THEM, to: ourNumber, body: 'On my way', media: ['https://example.com/pic.jpg'] }) });
  check('inbound simulated', inb.status === 201);

  r = await call(token, '/api/developers/conversations');
  const conv = (r.body.conversations || []).find((c) => c.counterparty === THEM);
  check('conversation exists', !!conv);
  check('unread incremented', conv?.unreadCount === 1, `unread=${conv?.unreadCount}`);
  check('contact name resolved', conv?.counterpartyName === 'Merge Target');
  check('last message is the inbound', conv?.lastBody === 'On my way' && conv?.lastDirection === 'inbound');

  // thread
  r = await call(token, `/api/developers/conversations/${conv.key}?limit=10`);
  check('thread has both messages', r.status === 200 && r.body.data.length >= 2);
  const inboundMsg = r.body.data.find((m) => m.direction === 'inbound');
  check('inbound media stored', Array.isArray(inboundMsg?.media) && inboundMsg.media[0].includes('example.com'));

  // mark read
  r = await call(token, `/api/developers/conversations/${conv.key}`, { method: 'POST' });
  check('mark read', r.status === 200 && r.body.read === true);
  r = await call(token, '/api/developers/conversations');
  check('unread cleared', (r.body.conversations || []).find((c) => c.key === conv.key)?.unreadCount === 0);

  // MMS gate on the public API
  const mms = await fetch(`${BASE}/api/v1/messages`, { method: 'POST', headers: { Authorization: `Bearer ${keySecret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ to: THEM, from: ourNumber, body: 'x', media: ['https://example.com/a.jpg'] }) });
  const mmsBody = await mms.json();
  check('outbound media 400 mms_not_enabled', mms.status === 400 && mmsBody.error?.code === 'mms_not_enabled');

  // template delete + cleanup
  r = await call(token, `/api/developers/templates?id=${tplId}`, { method: 'DELETE' });
  check('template deleted', r.status === 200);

  // cleanup: contact + conversation + thread of this run (recorded key)
  const digits = THEM.replace(/\D/g, '').slice(-10);
  const cid = (await db.ref(`apiContacts/${TENANT}/byDigits/${digits}`).get()).val();
  if (cid) { await db.ref(`apiContacts/${TENANT}/items/${cid}`).remove(); await db.ref(`apiContacts/${TENANT}/byDigits/${digits}`).remove(); }
  await db.ref(`apiConversations/${TENANT}/${conv.key}`).remove();
  await db.ref(`apiMessages/${TENANT}/byConv/${conv.key}`).remove();
  console.log(`cleaned: contact, conversation ${conv.key} (messages retained in the log by design)`);

  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
