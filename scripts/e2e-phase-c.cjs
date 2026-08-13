/* Phase C E2E: send queue, scheduled sends, broadcasts, opt-out skip, replay.
 * Sandbox-only on the fixture tenant. The cron is driven manually via its
 * route with CRON_SECRET. Cleanup by recorded ids. */
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
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`); };

async function call(token, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

const flushCron = async () => {
  const res = await fetch(`${BASE}/api/cron/api-send-flush`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  return res.json();
};

(async () => {
  const db = admin.database();
  const tenant = (await db.ref(`apiTenants/${TENANT}`).get()).val();
  const ownerUid = tenant.uid;
  const ourNumber = Object.values(tenant.numbers || {}).filter((n) => !n.releasedAt)[0].phoneNumber;
  const token = await idTokenFor(ownerUid);
  const keySecret = require('fs').readFileSync('/tmp/claude-1000/-home-alek-ghost-checkout/fe4037b5-a49e-4d39-8f1f-a1e153d61a8b/scratchpad/qa-key.txt', 'utf8').trim();

  const A = '+15005550180', B = '+15005550181', C = '+15005550182';
  const createdContacts = [];
  for (const [phone, name] of [[A, 'Cast A'], [B, 'Cast B'], [C, 'Cast C']]) {
    const r = await call(token, '/api/developers/contacts', { method: 'POST', body: JSON.stringify({ name, phone, tags: ['phase-c'] }) });
    createdContacts.push(r.body.contact.id);
  }
  check('3 contacts tagged', createdContacts.length === 3);

  // C opts out via inbound STOP
  await fetch(`${BASE}/api/v1/test/inbound`, { method: 'POST', headers: { Authorization: `Bearer ${keySecret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: C, to: ourNumber, body: 'STOP' }) });

  // ── scheduled 1:1 via public API ──
  let r = await fetch(`${BASE}/api/v1/messages`, { method: 'POST', headers: { Authorization: `Bearer ${keySecret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ to: A, from: ourNumber, body: 'scheduled hello', scheduled_at: Date.now() + 1500 }) });
  let body = await r.json();
  check('scheduled_at accepted (201, scheduled_message)', r.status === 201 && body.object === 'scheduled_message', JSON.stringify(body).slice(0, 100));
  const jobId = body.id;

  r = await call(token, '/api/developers/scheduled');
  check('scheduled listed', r.status === 200 && r.body.scheduled.some((j) => j.id === jobId));

  // past scheduled_at rejected
  r = await fetch(`${BASE}/api/v1/messages`, { method: 'POST', headers: { Authorization: `Bearer ${keySecret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ to: A, from: ourNumber, body: 'x', scheduled_at: Date.now() - 1000 }) });
  check('past scheduled_at 400', r.status === 400);

  // ── broadcast to the tag (immediate) ──
  r = await call(token, '/api/developers/broadcasts?preview=1&tags=phase-c');
  check('audience preview = 3', r.body.count === 3, `count=${r.body.count}`);

  r = await call(token, '/api/developers/broadcasts', {
    method: 'POST',
    body: JSON.stringify({ name: 'QA blast', body: 'Hi {{first_name}}, test {{field:code}}', from: ourNumber, tags: ['phase-c'] }),
  });
  check('broadcast created', r.status === 201, JSON.stringify(r.body).slice(0, 120));
  const bcId = r.body.broadcast?.id;

  // ── drive the cron ──
  await new Promise((res) => setTimeout(res, 1600)); // let the scheduled job come due
  const flush1 = await flushCron();
  check('cron flushed jobs', flush1.sent >= 1, JSON.stringify(flush1));

  // broadcast counts settle
  r = await call(token, '/api/developers/broadcasts');
  const bc = (r.body.broadcasts || []).find((b) => b.id === bcId);
  check('broadcast complete', bc?.status === 'complete', `status=${bc?.status}`);
  check('counts: 2 sent, 1 opted out', bc?.counts.sent === 2 && bc?.counts.skipped_opt_out === 1, JSON.stringify(bc?.counts));

  // merge rendered per recipient (check A's thread has the personalized body)
  const convKey = `${ourNumber.replace(/\D/g, '').slice(-10)}_${A.replace(/\D/g, '').slice(-10)}`;
  r = await call(token, `/api/developers/conversations/${convKey}?limit=10`);
  const blast = (r.body.data || []).find((m) => m.body.startsWith('Hi Cast,'));
  check('merge rendered in broadcast send', !!blast, (r.body.data || []).map((m) => m.body).join(' | ').slice(0, 120));

  // scheduled 1:1 also landed
  const scheduledMsg = (r.body.data || []).find((m) => m.body === 'scheduled hello');
  check('scheduled 1:1 delivered by cron', !!scheduledMsg);

  // ── cancel path ──
  r = await fetch(`${BASE}/api/v1/messages`, { method: 'POST', headers: { Authorization: `Bearer ${keySecret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ to: A, from: ourNumber, body: 'cancel me', scheduled_at: Date.now() + 60_000 }) });
  body = await r.json();
  r = await call(token, `/api/developers/scheduled?id=${body.id}`, { method: 'DELETE' });
  check('scheduled cancel', r.status === 200 && r.body.canceled === true);

  // ── event replay ──
  r = await call(token, '/api/developers/../developers/events'.replace('/../developers',''), {});
  // (list events, take latest)
  r = await call(token, '/api/developers/events?limit=1');
  const evtId = r.body?.data?.[0]?.id || r.body?.events?.[0]?.id;
  if (evtId) {
    r = await call(token, `/api/developers/events/${evtId}/replay`, { method: 'POST' });
    check('event replay', r.status === 200 && r.body.replayed === true, JSON.stringify(r.body).slice(0, 80));
  } else {
    check('event replay', false, 'no event id found: ' + JSON.stringify(r.body).slice(0, 120));
  }

  // ── cleanup: recorded ids only ──
  for (const phone of [A, B, C]) {
    const digits = phone.replace(/\D/g, '').slice(-10);
    const cid = (await db.ref(`apiContacts/${TENANT}/byDigits/${digits}`).get()).val();
    if (cid) { await db.ref(`apiContacts/${TENANT}/items/${cid}`).remove(); await db.ref(`apiContacts/${TENANT}/byDigits/${digits}`).remove(); }
    const ck = `${ourNumber.replace(/\D/g, '').slice(-10)}_${digits}`;
    await db.ref(`apiConversations/${TENANT}/${ck}`).remove();
    await db.ref(`apiMessages/${TENANT}/byConv/${ck}`).remove();
    await db.ref(`apiOptOut/${TENANT}/${digits}`).remove();
  }
  if (bcId) await db.ref(`apiBroadcasts/${TENANT}/${bcId}`).remove();
  console.log('cleaned: 3 contacts, 3 conversations, opt-out, broadcast record');

  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
