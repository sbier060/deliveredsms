#!/usr/bin/env node
// Tell the crawlers a URL changed, instead of waiting to be crawled.
//
//   node scripts/indexnow.js              submit what changed since last time
//   node scripts/indexnow.js --all        submit every URL in the sitemaps
//   node scripts/indexnow.js --dry-run    print the list, send nothing
//
// RUN IT AFTER THE DEPLOY, never in postbuild. The engines act on a submission
// within minutes; announcing at build time points them at the version still
// sitting in .next on the machine that built it, so they re-read the page you
// were replacing and you spend credibility to do it. On Vercel that means: push,
// wait for the deployment to be Ready, then run this.
//
// ── What IndexNow is ────────────────────────────────────────────────────────
//
// Bing, Yandex, Seznam, Naver and DuckDuckGo share one endpoint. You POST your
// changed URLs plus a key; they fetch <key>.txt from the domain root to prove
// the list came from someone who controls the host. Google does not participate
// — Search Console is its only push surface — so this is not a substitute for
// submitting the sitemap there.
//
// ── Why only what changed ───────────────────────────────────────────────────
//
// The protocol asks for changed URLs, and hosts that re-push their whole sitemap
// on a schedule get rate-limited, at which point real changes queue behind their
// own noise. The hashes in scripts/lastmod.json already say which pages moved
// (they are what dates the sitemap), so this diffs against the set that was last
// accepted and usually submits one or two URLs.

const fs = require('fs');
const path = require('path');

// Self-generated, 2026-08-17. IndexNow keys do not have to be issued by an
// engine: any 8-128 hex characters work, and the proof is that the same string
// is served from the domain root. Paste one from Bing Webmaster Tools here
// instead if you prefer them to have it on file. Rotating is a three-step move:
// change this, deploy (the .txt is written by scripts/generate-robots.js), THEN
// submit — a key whose file is not live yet earns a 403.
const KEY = 'd1353e12be39dc0d1ace02c09540b6ce';
const DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN || 'deliveredsms.com';
const BASE = `https://${DOMAIN}`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const RECORD = path.join(ROOT, 'scripts', 'lastmod.json');
const STATE = path.join(ROOT, 'scripts', 'indexnow-state.json');

const KEY_FILE = `${KEY}.txt`;
const KEY_LOCATION = `${BASE}/${KEY_FILE}`;

module.exports = { KEY, KEY_FILE, KEY_LOCATION };

if (require.main !== module) return;

const argv = process.argv.slice(2);
const ALL = argv.includes('--all');
const DRY = argv.includes('--dry-run');
const SKIP_VERIFY = argv.includes('--skip-verify');

const die = (m) => {
  console.error(`\n  ✗ ${m}\n`);
  process.exit(1);
};

// ── 1. what the sitemaps publish ────────────────────────────────────────────

const locs = (file) => {
  const xml = fs.readFileSync(path.join(PUBLIC, file), 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
};
if (!fs.existsSync(path.join(PUBLIC, 'sitemap.xml'))) die('public/sitemap.xml missing — run `npm run build` first');
const children = locs('sitemap.xml').map((u) => u.replace(`${BASE}/`, ''));
const published = [...new Set(children.flatMap((c) => locs(c)))];
if (!published.length) die('the sitemaps list no URLs, which is never right');

// ── 2. pick the ones to send ────────────────────────────────────────────────

if (!fs.existsSync(RECORD)) die('scripts/lastmod.json missing — it is what tracks which pages changed');
const hashes = JSON.parse(fs.readFileSync(RECORD, 'utf8'));
const sent = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')).urls ?? {} : {};

const urls = ALL
  ? published
  : published.filter((u) => {
      const h = hashes[u]?.hash ?? null;
      // No hash means no identifiable source file (see generate-sitemap.js).
      // Submit it once, then leave it alone rather than pushing it every deploy.
      return h ? sent[u] !== h : !(u in sent);
    });

console.log(`\n  IndexNow · ${published.length} published, ${urls.length} to submit`);
for (const u of urls) console.log(`      ${sent[u] ? '~' : '+'} ${u}`);
if (!urls.length) {
  console.log('\n  ✓ nothing has changed — no submission sent\n');
  process.exit(0);
}
if (DRY) {
  console.log(`\n  (--dry-run) key ${KEY}, keyLocation ${KEY_LOCATION}\n`);
  process.exit(0);
}

// ── 3. the key file has to be live, or every submission is a silent 403 ─────

(async () => {
  if (!SKIP_VERIFY) {
    const res = await fetch(KEY_LOCATION).catch((e) => ({ error: e }));
    if (res.error) die(`could not fetch ${KEY_LOCATION} (${res.error.message}) — pass --skip-verify to submit anyway`);
    if (!res.ok) die(`${KEY_LOCATION} returned ${res.status} — deploy first, the key file must be live before submitting`);
    // Check the BODY, not the status: a host that rewrites unknown paths to an
    // app shell answers 200 with HTML where the engines expect 32 hex characters.
    const body = (await res.text()).trim();
    if (body !== KEY) die(`${KEY_LOCATION} serves "${body.slice(0, 40)}", not the key in scripts/indexnow.js`);
    console.log(`  ✓ key file verified at ${KEY_LOCATION}`);
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: DOMAIN, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
  });
  const text = await res.text().catch(() => '');
  console.log(`  → HTTP ${res.status}${text ? ` ${text.slice(0, 200)}` : ''}`);
  // 200 = accepted, 202 = accepted with the key still pending validation.
  if (!res.ok) die('rejected — state not updated, so the next run retries these URLs');

  const next = { ...sent };
  for (const u of published) next[u] = hashes[u]?.hash ?? null;
  fs.writeFileSync(
    STATE,
    `${JSON.stringify({ key: KEY, submittedAt: new Date().toISOString(), urls: next }, null, 2)}\n`
  );
  console.log(`\n  ✓ submitted ${urls.length} URL(s) to the IndexNow engines`);
  console.log('    Google does not participate — that path is still the sitemap + Search Console.\n');
})();
