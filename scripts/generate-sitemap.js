// Resms sitemap generator - a sitemap INDEX at /sitemap.xml pointing at
// per-section sitemaps (the resend.com shape). Doc and tool slugs are read
// from the same registries the pages render from, so the sitemap tracks the
// site automatically.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN || 'resms.com';
const BASE = `https://${DOMAIN}`;

function slugsFrom(file) {
  try {
    const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    return [...src.matchAll(/^\s*slug:\s*'([a-z0-9-]+)'/gm)].map((m) => m[1]);
  } catch (err) {
    console.warn(`Could not read slugs from ${file}:`, err.message);
    return [];
  }
}

const docSlugs = [...new Set(slugsFrom('src/lib/dev-docs/content.ts'))];
const toolSlugs = [...new Set(slugsFrom('src/lib/dev-docs/tools.ts'))];

// ── lastmod that means something ────────────────────────────────────────────
//
// Every URL used to carry `new Date()`, so a Tuesday deploy told Google that all
// 35 pages changed on Tuesday, including the 30 whose source had not been
// touched in weeks. Google states that it ignores lastmod it finds inconsistent
// with the page, so the field was not merely uninformative: it was teaching the
// crawler to disregard the whole file, and the pages that HAD changed lost the
// one signal they had.
//
// So: hash the source that renders each URL, and keep the date it last changed
// in scripts/lastmod.json (committed, because regenerating it from scratch would
// reset every page to "changed today" — the bug this replaces). A doc page's
// source is its own block inside content.ts, not the whole file, or editing one
// doc would re-date all seventeen.
const today = new Date().toISOString().slice(0, 10);
const RECORD = path.join(process.cwd(), 'scripts', 'lastmod.json');
const previous = fs.existsSync(RECORD) ? JSON.parse(fs.readFileSync(RECORD, 'utf8')) : {};
const record = {};

const read = (rel) => {
  try { return fs.readFileSync(path.join(process.cwd(), rel), 'utf8'); } catch { return null; }
};
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);

/** The slice of a registry file that defines one slug, so per-page edits date per page. */
function blockFor(rel, slug) {
  const src = read(rel);
  if (!src) return null;
  const start = src.indexOf(`slug: '${slug}'`);
  if (start === -1) return null;
  const next = src.indexOf("slug: '", start + 8);
  return src.slice(start, next === -1 ? src.length : next);
}

function lastmod(loc, source) {
  const text = source ?? null;
  // No identifiable source (an app route with no single file behind it): fall
  // back to the recorded date if there is one, today if this URL is new.
  const h = text ? hash(text) : null;
  const was = previous[loc];
  const date = h && was && was.hash === h ? was.date : was && !h ? was.date : today;
  record[loc] = { hash: h, date };
  return date;
}

const entry = (loc, priority, source) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod(loc, source)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>
`;

const URLSET_OPEN =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

let main = URLSET_OPEN;
main += entry(`${BASE}/`, '1.0', read('src/app/page.tsx'));
main += entry(`${BASE}/pricing`, '0.9', read('src/app/pricing/page.tsx'));
// Primary nav destinations - these are what Google draws sitelinks from, so
// they must be in the sitemap as well as in SITE_NAV (src/lib/site-schema.ts).
main += entry(`${BASE}/login`, '0.8', read('src/app/login/page.tsx'));
main += entry(`${BASE}/signup`, '0.8', read('src/app/signup/page.tsx'));
main += entry(`${BASE}/agents`, '0.8', read('src/app/agents/page.tsx'));
main += entry(`${BASE}/terms`, '0.4', read('src/app/terms/page.tsx'));
main += entry(`${BASE}/privacy`, '0.4', read('src/app/privacy/page.tsx'));
for (const slug of toolSlugs) {
  main += entry(`${BASE}/${slug}`, '0.7', blockFor('src/lib/dev-docs/tools.ts', slug));
}
main += '</urlset>';

let docs = URLSET_OPEN;
docs += entry(`${BASE}/docs`, '0.9', read('src/lib/dev-docs/content.ts'));
for (const slug of docSlugs) {
  docs += entry(`${BASE}/docs/${slug}`, '0.8', blockFor('src/lib/dev-docs/content.ts', slug));
}
docs += '</urlset>';

// The index's own lastmod is the newest date in each child, not the build clock:
// the same reasoning one level up.
const newest = (xml) =>
  [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]).sort().pop() ?? today;
const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${BASE}/sitemap-main.xml</loc><lastmod>${newest(main)}</lastmod></sitemap>
  <sitemap><loc>${BASE}/sitemap-docs.xml</loc><lastmod>${newest(docs)}</lastmod></sitemap>
</sitemapindex>`;

const pub = path.join(process.cwd(), 'public');
fs.writeFileSync(path.join(pub, 'sitemap.xml'), index);
fs.writeFileSync(path.join(pub, 'sitemap-main.xml'), main);
fs.writeFileSync(path.join(pub, 'sitemap-docs.xml'), docs);
// Keep records for URLs that are not currently listed, so removing a page and
// putting it back does not reset its date.
for (const [loc, rec] of Object.entries(previous)) if (!record[loc]) record[loc] = rec;
const sorted = Object.fromEntries(Object.keys(record).sort().map((k) => [k, record[k]]));
fs.writeFileSync(RECORD, `${JSON.stringify(sorted, null, 2)}\n`);

const changed = Object.values(record).filter((r) => r.date === today).length;
console.log(
  `Sitemaps written: main ${3 + toolSlugs.length} URLs, docs ${1 + docSlugs.length} URLs; ` +
    `${changed} dated today, the rest kept their recorded lastmod`
);
