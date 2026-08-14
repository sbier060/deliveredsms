/* Consent/TCPA E2E against a local prod build (next start -p 3116).
 * Creates: opt-out records for 3 QA numbers + 1 legacy seed - all exact,
 * recorded, and removed in cleanup per the destructive-ops policy.
 * The AI tier is not exercised (deterministic phrase tier only). */
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const BASE = process.env.E2E_BASE || 'http://localhost:3116';
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
const check = (name, ok, detail = '') => {
  results.push([ok, name]);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`);
};
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

(async () => {
  const runStart = new Date().toISOString();
  const db = admin.database();
  const tenant = (await db.ref(`apiTenants/${TENANT}`).get()).val();
  if (!tenant) throw new Error('fixture tenant missing');

  const nums = await v1('/numbers');
  const OURS = nums.body.data[0].phone_number;
  const PHRASE = '+15005559761'; // phrase-tier revocation subject
  const LEGACY = '+15005559762'; // legacy-trap subject
  const IMPORT = ['+15005559763', '+15005559764'];
  const phraseDigits = PHRASE.replace(/\D/g, '').slice(-10);
  const legacyDigits = LEGACY.replace(/\D/g, '').slice(-10);
  const cleanupPaths = [
    `apiOptOut/${TENANT}/${phraseDigits}`,
    `apiOptIn/${TENANT}/${phraseDigits}`,
    `apiConsentLog/${TENANT}/${phraseDigits}`,
    `apiOptOut/${TENANT}/${legacyDigits}`,
    `apiOptIn/${TENANT}/${legacyDigits}`,
    `apiConsentLog/${TENANT}/${legacyDigits}`,
    `apiVerifyOptOut/${legacyDigits}`,
    ...IMPORT.flatMap((n) => {
      const d = n.replace(/\D/g, '').slice(-10);
      return [`apiOptOut/${TENANT}/${d}`, `apiConsentLog/${TENANT}/${d}`];
    }),
  ];

  // ── 1. Plain-English revocation ──
  let r = await v1('/test/inbound', { method: 'POST', body: JSON.stringify({ from: PHRASE, to: OURS, body: 'please stop texting me' }) });
  check('phrase inbound accepted', r.status === 200 || r.status === 201);
  await sleep(1200);
  r = await v1('/messages', { method: 'POST', body: JSON.stringify({ from: OURS, to: PHRASE, body: 'should be blocked' }) });
  check('phrase revocation blocks send 403', r.status === 403, String(r.status));
  r = await v1('/events?limit=20');
  const optedOut = (r.body.data || []).find((e) => e.type === 'message.opted_out' && e.data?.phone === PHRASE);
  check('opted_out event method=phrase', optedOut?.data?.method === 'phrase', JSON.stringify(optedOut?.data || {}).slice(0, 120));
  // Events are append-only per tenant; only count this run's.
  const sentEvents = (r.body.data || []).filter((e) => e.type === 'message.sent' && e.data?.to === PHRASE && e.created_at > runStart);
  check('confirmation reply sent, no auto-reply', sentEvents.length === 1 && sentEvents[0].data?.kind === 'keyword_reply', `count ${sentEvents.length}`);

  // consent API view
  r = await v1(`/consent/${encodeURIComponent(PHRASE)}`);
  check('GET consent shows opted_out + history', r.status === 200 && r.body.status === 'opted_out' && r.body.history.length >= 1 && r.body.history[0].type === 'opt_out' && r.body.history[0].method === 'phrase');

  // ── 2. START restores; history retained ──
  r = await v1('/test/inbound', { method: 'POST', body: JSON.stringify({ from: PHRASE, to: OURS, body: 'START' }) });
  await sleep(1200);
  r = await v1('/messages', { method: 'POST', body: JSON.stringify({ from: OURS, to: PHRASE, body: 'unblocked' }) });
  check('send allowed after START', r.status === 201, String(r.status));
  r = await v1(`/consent/${encodeURIComponent(PHRASE)}`);
  const types = (r.body.history || []).map((h) => h.type);
  check('history keeps opt_out AND opt_in', r.body.status === 'opted_in' && types.includes('opt_out') && types.includes('opt_in'), types.join(','));

  // ── 3. Legacy trap fix ──
  await db.ref(`apiVerifyOptOut/${legacyDigits}`).set({ at: Date.now(), via: 'qa_seed' });
  r = await v1('/messages', { method: 'POST', body: JSON.stringify({ from: OURS, to: LEGACY, body: 'legacy blocked?' }) });
  check('legacy global record blocks send', r.status === 403, String(r.status));
  r = await v1(`/consent/${encodeURIComponent(LEGACY)}`, { method: 'POST', body: JSON.stringify({ status: 'opted_in', note: 'qa legacy-trap check' }) });
  check('API opt-in accepted', r.status === 200);
  r = await v1('/messages', { method: 'POST', body: JSON.stringify({ from: OURS, to: LEGACY, body: 'legacy unblocked' }) });
  check('scoped opt-in outranks legacy global', r.status === 201, String(r.status));

  // ── 4. Import + list + export round-trip ──
  r = await v1('/consent/import', { method: 'POST', body: JSON.stringify({ phone_numbers: [...IMPORT, 'garbage'] }) });
  check('import counts correct', r.status === 200 && r.body.imported === 2 && r.body.skipped.length === 1, JSON.stringify(r.body).slice(0, 100));
  r = await v1('/consent?limit=100');
  const listed = (r.body.data || []).map((c) => c.phone);
  check('imported numbers listed', IMPORT.every((n) => listed.includes(n)));
  const csvRes = await fetch(`${BASE}/api/v1/consent/export`, { headers: { Authorization: `Bearer ${KEY}` } });
  const csv = await csvRes.text();
  check('export CSV contains imports', csvRes.status === 200 && IMPORT.every((n) => csv.includes(n)) && csv.startsWith('phone,status'));

  // ── 5. Verify exemption still sends + audited ──
  r = await v1('/verify', { method: 'POST', body: JSON.stringify({ to: IMPORT[0] }) });
  check('verify exempt from opt-out', r.status === 201, JSON.stringify(r.body).slice(0, 80));
  r = await v1(`/consent/${encodeURIComponent(IMPORT[0])}`);
  check('exempt_send in ledger', (r.body.history || []).some((h) => h.type === 'exempt_send'));
  r = await v1('/events?limit=20');
  check('verification.sent_to_opted_out event', (r.body.data || []).some((e) => e.type === 'verification.sent_to_opted_out' && e.data?.phone === IMPORT[0]));

  // ── Cleanup: exact recorded paths only ──
  for (const path of cleanupPaths) await db.ref(path).remove();
  console.log(`cleaned ${cleanupPaths.length} exact QA paths (incl. legacy seed apiVerifyOptOut/${legacyDigits})`);

  const passed = results.filter(([ok]) => ok).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
