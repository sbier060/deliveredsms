/* Phase A E2E: teams + contacts, against a local prod build.
 * Creates: 3 QA contacts (removed at the end — exact recorded ids only),
 * 1 invite (removed), 1 invitee auth user (NOT deleted — uid printed for
 * explicit cleanup approval per the destructive-ops policy; it is disabled
 * instead so it cannot be used). */
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
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) }
  );
  const data = await res.json();
  if (!data.idToken) throw new Error('token exchange failed: ' + JSON.stringify(data).slice(0, 200));
  return data.idToken;
}

const results = [];
function check(name, ok, detail = '') {
  results.push([ok, name]);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function call(token, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

(async () => {
  const db = admin.database();
  const tenant = (await db.ref(`apiTenants/${TENANT}`).get()).val();
  if (!tenant) throw new Error('fixture tenant missing');
  const ownerUid = tenant.uid;
  console.log(`fixture tenant ${TENANT}, owner uid ${ownerUid}`);

  const ownerToken = await idTokenFor(ownerUid);

  // ── Contacts ──
  let r = await call(ownerToken, '/api/developers/contacts', {
    method: 'POST',
    body: JSON.stringify({ name: 'QA Alpha', phone: '+15005550120', tags: ['qa', 'vip'], fields: { company: 'Ghost' } }),
  });
  check('contact create', r.status === 201 && r.body.contact?.name === 'QA Alpha');
  const contactId = r.body.contact?.id;

  r = await call(ownerToken, '/api/developers/contacts', {
    method: 'POST',
    body: JSON.stringify({ name: 'QA Alpha Renamed', phone: '+15005550120', tags: ['second'] }),
  });
  check('upsert by phone (no dupe)', r.status === 200 && r.body.created === false && r.body.contact.id === contactId);
  check('upsert merges tags', (r.body.contact.tags || []).includes('vip') && r.body.contact.tags.includes('second'));

  r = await call(ownerToken, '/api/developers/contacts?q=alpha');
  check('search by name', r.status === 200 && r.body.contacts.length === 1);
  r = await call(ownerToken, '/api/developers/contacts?tag=vip');
  check('filter by tag', r.status === 200 && r.body.contacts.length === 1);

  r = await call(ownerToken, '/api/developers/contacts/import', {
    method: 'POST',
    body: JSON.stringify({
      rows: [
        { name: 'QA Beta', phone: '+15005550121', tags: ['qa'] },
        { name: 'QA Gamma', phone: '+15005550122', tags: ['qa'] },
        { name: 'Bad Row', phone: 'not-a-phone' },
      ],
    }),
  });
  check('import counts (2 in, 1 skipped)', r.body.created === 2 && r.body.skipped.length === 1, JSON.stringify(r.body).slice(0, 120));

  const exp = await fetch(`${BASE}/api/developers/contacts/export`, { headers: { Authorization: `Bearer ${ownerToken}` } });
  const csv = await exp.text();
  check('export CSV round-trip', exp.headers.get('content-type')?.includes('text/csv') && csv.includes('+15005550121') && csv.includes('QA Alpha Renamed'));

  // ── Teams ──
  r = await call(ownerToken, '/api/developers/team');
  check('team list (owner is admin)', r.status === 200 && r.body.you.role === 'admin' && r.body.owner.uid === ownerUid);

  r = await call(ownerToken, '/api/developers/team/invites', { method: 'POST', body: JSON.stringify({ role: 'member' }) });
  check('invite created', r.status === 200 && typeof r.body.token === 'string');
  const inviteToken = r.body.token;

  const inviteeEmail = `phase-a-invitee-${Date.now()}@ghostforge-e2e.test`;
  const invitee = await admin.auth().createUser({ email: inviteeEmail, displayName: 'QA Invitee' });
  console.log(`FIXTURE-CREATED auth user: ${invitee.uid} (${inviteeEmail})`);
  const inviteeToken = await idTokenFor(invitee.uid);

  r = await call(inviteeToken, '/api/developers/team/invites/accept', { method: 'POST', body: JSON.stringify({ token: inviteToken }) });
  check('invite accept', r.status === 200 && r.body.joined === true && r.body.tenantId === TENANT);

  r = await call(inviteeToken, '/api/developers/team/invites/accept', { method: 'POST', body: JSON.stringify({ token: inviteToken }) });
  check('invite single-use', r.status === 409);

  r = await call(inviteeToken, '/api/developers/contacts');
  check('member reads contacts', r.status === 200 && r.body.contacts.some((c) => c.name === 'QA Beta'));

  r = await call(inviteeToken, '/api/developers/keys');
  check('member blocked from keys', r.status === 403, `got ${r.status}`);

  r = await call(inviteeToken, '/api/developers/team/invites', { method: 'POST', body: JSON.stringify({}) });
  check('member cannot invite', r.status === 403);

  r = await call(ownerToken, `/api/developers/team/${invitee.uid}`, { method: 'DELETE' });
  check('admin removes member', r.status === 200 && r.body.deleted === true);

  r = await call(inviteeToken, '/api/developers/contacts');
  check('removed member loses access', r.status === 404, `got ${r.status}`);

  // ── Cleanup: exact ids this run created ──
  for (const phone of ['+15005550120', '+15005550121', '+15005550122']) {
    const digits = phone.replace(/\D/g, '').slice(-10);
    const idSnap = await db.ref(`apiContacts/${TENANT}/byDigits/${digits}`).get();
    if (idSnap.exists()) {
      await db.ref(`apiContacts/${TENANT}/items/${idSnap.val()}`).remove();
      await db.ref(`apiContacts/${TENANT}/byDigits/${digits}`).remove();
    }
  }
  await db.ref(`apiInvites/${inviteToken}`).remove();
  await admin.auth().updateUser(invitee.uid, { disabled: true });
  console.log(`cleaned: 3 QA contacts + invite. Auth user ${invitee.uid} DISABLED, not deleted — needs explicit approval to remove.`);

  const failed = results.filter(([ok]) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
