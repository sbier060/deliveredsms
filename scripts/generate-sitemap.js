// Delivered sitemap generator — a sitemap INDEX at /sitemap.xml pointing at
// per-section sitemaps (the resend.com shape). Doc and tool slugs are read
// from the same registries the pages render from, so the sitemap tracks the
// site automatically.
const fs = require('fs');
const path = require('path');

const DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN || 'deliveredsms.com';
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

const now = new Date().toISOString();

const entry = (loc, priority) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>
`;

const URLSET_OPEN =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

let main = URLSET_OPEN;
main += entry(`${BASE}/`, '1.0');
main += entry(`${BASE}/pricing`, '0.9');
main += entry(`${BASE}/agents`, '0.8');
main += entry(`${BASE}/terms`, '0.4');
main += entry(`${BASE}/privacy`, '0.4');
for (const slug of toolSlugs) main += entry(`${BASE}/${slug}`, '0.7');
main += '</urlset>';

let docs = URLSET_OPEN;
docs += entry(`${BASE}/docs`, '0.9');
for (const slug of docSlugs) docs += entry(`${BASE}/docs/${slug}`, '0.8');
docs += '</urlset>';

const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${BASE}/sitemap-main.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${BASE}/sitemap-docs.xml</loc><lastmod>${now}</lastmod></sitemap>
</sitemapindex>`;

const pub = path.join(process.cwd(), 'public');
fs.writeFileSync(path.join(pub, 'sitemap.xml'), index);
fs.writeFileSync(path.join(pub, 'sitemap-main.xml'), main);
fs.writeFileSync(path.join(pub, 'sitemap-docs.xml'), docs);
console.log(
  `Sitemaps written: main ${3 + toolSlugs.length} URLs, docs ${1 + docSlugs.length} URLs`
);
