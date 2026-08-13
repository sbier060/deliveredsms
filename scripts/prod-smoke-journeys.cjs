/* Production smoke: the key user journeys the homepage now advertises, run
 * against the live site with the sandbox fixture tenant. Sandbox-only sends
 * (nothing routable, nothing billed). Cleans up the exact conversation keys
 * it creates; message log entries are retained by design (append-only).
 *
 *   QA_KEY_FILE=<path to sandbox key> node scripts/prod-smoke-journeys.cjs
 */
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const BASE = process.env.E2E_BASE || 'https://deliveredsms.com';
const TENANT = 'tn_WUzMljSTvH2W';
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const KEY = process.env.QA_KEY || require('fs').readFileSync(process.env.QA_KEY_FILE, 'utf8').trim();

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const results = [];
function check(name, ok, detail = '') {
  results.push([ok, name]);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function v1(path, opts = {}) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

async function idTokenFor(uid) {
  const custom = await admin.auth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) }
  );
  const data = await res.json();
  if (!data.idToken) throw new Error('token exchange failed');
  return data.idToken;
}

async function console_(token, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

(async () => {
  const db = admin.database();
  const tenant = (await db.ref(`apiTenants/${TENANT}`).get()).val();
  if (!tenant) throw new Error('fixture tenant missing');
  const token = await idTokenFor(tenant.uid);
  const THEM = '+15005559431'; // dedicated smoke counterparty, sandbox range
  const themDigits = THEM.replace(/\D/g, '').slice(-10);
  const createdConvKeys = new Set();

  // our sandbox number (for from/inbound)
  let r = await v1('/numbers');
  check('numbers list', r.status === 200 && r.body.data.length > 0);
  const OURS = r.body.data[0].phone_number;
  const oursDigits = OURS.replace(/\D/g, '').slice(-10);
  const convKey = `${oursDigits}_${themDigits}`;

  // ── Journey 1: send & receive ──
  r = await v1('/messages', { method: 'POST', body: JSON.stringify({ from: OURS, to: '+15005550006', body: 'smoke: happy path' }) });
  check('send returns id', r.status === 201 && /^msg_/.test(r.body.id), JSON.stringify(r.body).slice(0, 80));
  const msgId = r.body.id;
  createdConvKeys.add(`${oursDigits}_5005550006`);
  // Contract: the stored message stays 'sent' (DLRs are carrier work); the
  // sandbox delivered signal is the message.delivered event ~2s later.
  await sleep(3000);
  r = await v1(`/messages/${msgId}`);
  check('message readable by id', r.status === 200 && r.body.status === 'sent', r.body.status);
  r = await v1('/events?limit=20');
  check('message.delivered event for this send', (r.body.data || []).some((e) => e.type === 'message.delivered' && e.data?.message_id === msgId));

  r = await v1('/messages', { method: 'POST', body: JSON.stringify({ from: OURS, to: '+15005550002', body: 'smoke: fail path' }) });
  const failId = r.body.id;
  createdConvKeys.add(`${oursDigits}_5005550002`);
  await sleep(2500);
  r = await v1(`/messages/${failId}`);
  check('failed send reports status', r.status === 200 && r.body.status === 'failed');

  // inbound → event + conversation
  r = await v1('/test/inbound', { method: 'POST', body: JSON.stringify({ from: THEM, to: OURS, body: 'smoke: inbound hello' }) });
  check('test inbound accepted', r.status === 200 || r.status === 201, String(r.status));
  createdConvKeys.add(convKey);
  await sleep(1500);
  r = await v1('/events?limit=20');
  const types = (r.body.data || []).map((e) => e.type);
  check('message.received event', types.includes('message.received'), types.slice(0, 6).join(','));

  // ── Journey 2: numbers ──
  r = await v1('/numbers/available?area_code=415');
  check('available numbers search', r.status === 200 && r.body.data.length > 0);

  // ── Journey 3: verify ──
  r = await v1('/verify', { method: 'POST', body: JSON.stringify({ to: '+15005558812' }) });
  check('verify starts', r.status === 201 && /^ver_/.test(r.body.id), JSON.stringify(r.body).slice(0, 80));
  r = await v1('/verify/check', { method: 'POST', body: JSON.stringify({ to: '+15005558812', code: '000000' }) });
  check('wrong code not verified, not charged', r.status === 200 && r.body.verified === false && r.body.charged === false && r.body.attempts_remaining < 5, JSON.stringify(r.body).slice(0, 100));
  r = await v1('/verify', { method: 'POST', body: JSON.stringify({ to: '+15005550003' }) });
  check('verify cooldown magic number 429', r.status === 429);

  // ── Journey 4: inbox (console) ──
  r = await console_(token, '/api/developers/conversations');
  const conv = (r.body.conversations || []).find((c) => c.key === convKey);
  check('conversation appears in inbox', !!conv && conv.unreadCount >= 1, conv ? `unread ${conv.unreadCount}` : 'missing');
  r = await console_(token, `/api/developers/conversations/${convKey}?limit=10`);
  check('thread loads', r.status === 200 && (r.body.data || []).some((m) => m.body === 'smoke: inbound hello'));
  r = await console_(token, `/api/developers/conversations/${convKey}`, { method: 'POST' });
  const cleared = r.status === 200;
  r = await console_(token, '/api/developers/conversations');
  const conv2 = (r.body.conversations || []).find((c) => c.key === convKey);
  check('mark read clears unread', cleared && conv2 && conv2.unreadCount === 0, conv2 ? `unread ${conv2.unreadCount}` : 'missing');

  // ── Journey 5: opt-out (STOP / START) ──
  r = await v1('/test/inbound', { method: 'POST', body: JSON.stringify({ from: THEM, to: OURS, body: 'STOP' }) });
  check('STOP accepted', r.status === 200 || r.status === 201);
  await sleep(1500);
  r = await v1('/messages', { method: 'POST', body: JSON.stringify({ from: OURS, to: THEM, body: 'smoke: should be blocked' }) });
  check('send to opted-out blocked 403', r.status === 403, String(r.status));
  r = await v1('/events?limit=20');
  check('message.opted_out event', (r.body.data || []).some((e) => e.type === 'message.opted_out'));
  r = await v1('/test/inbound', { method: 'POST', body: JSON.stringify({ from: THEM, to: OURS, body: 'START' }) });
  await sleep(1500);
  r = await v1('/messages', { method: 'POST', body: JSON.stringify({ from: OURS, to: THEM, body: 'smoke: unblocked after START' }) });
  check('send allowed after START', r.status === 201, String(r.status));

  // ── Journey 6: scheduled ──
  const runAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  r = await v1('/messages', { method: 'POST', body: JSON.stringify({ from: OURS, to: '+15005550006', body: 'smoke: scheduled', scheduled_at: runAt }) });
  check('scheduled send accepted', r.status === 201 && r.body.object === 'scheduled_message', JSON.stringify(r.body).slice(0, 80));
  const jobId = r.body.id;
  r = await console_(token, '/api/developers/scheduled');
  check('scheduled job listed', (r.body.scheduled || []).some((j) => j.id === jobId));
  r = await console_(token, `/api/developers/scheduled?id=${jobId}`, { method: 'DELETE' });
  const cancelOk = r.status === 200;
  r = await console_(token, '/api/developers/scheduled');
  check('scheduled job cancelled', cancelOk && !(r.body.scheduled || []).some((j) => j.id === jobId));

  // ── Journey 7: team + search ──
  r = await console_(token, '/api/developers/team');
  check('team lists owner as admin', r.status === 200 && r.body.you?.role === 'admin' && r.body.owner?.uid === tenant.uid);
  r = await console_(token, '/api/developers/search?q=inbound hello');
  check('search finds the message', r.status === 200 && (r.body.messages || []).some((m) => m.body.includes('inbound hello')));

  // ── Cleanup: exact conversation keys created this run ──
  for (const key of createdConvKeys) {
    await db.ref(`apiConversations/${TENANT}/${key}`).remove();
    await db.ref(`apiMessages/${TENANT}/byConv/${key}`).remove();
  }
  console.log(`cleaned conversations: ${[...createdConvKeys].join(', ')}`);

  const passed = results.filter(([ok]) => ok).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
