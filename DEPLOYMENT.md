# Deployment

Vercel, Next.js. `npm run build` runs `postbuild`, which regenerates
`public/sitemap*.xml` and `public/robots.txt` — the sitemaps are build
artifacts, never hand-edited.

## Search engine submission

Sitemap index: `https://resms.com/sitemap.xml`
(children: `sitemap-main.xml`, `sitemap-docs.xml`)

Submit the index only — Google, Bing, and Yandex follow the children
themselves.

### IndexNow keys

`node scripts/indexnow.js` announces changed URLs. It must run **after** the
deploy is live, never during the build: the engines crawl within minutes, so
announcing early re-indexes the old page. The script fetches `<key>.txt` from
the domain root first and refuses to submit if it is missing or stale — a key
whose file is not live yet earns a 403 on every submission.

**The key for resms.com is `658e0a42de5c4ddb9a369b1f79fc8e17`**, issued
by Bing Webmaster Tools on 2026-08-17. It lives in two places that must never
drift apart:

- `KEY` in [`scripts/indexnow.js`](scripts/indexnow.js) — the one submitted
- `public/658e0a42de5c4ddb9a369b1f79fc8e17.txt`, served at
  `https://resms.com/658e0a42de5c4ddb9a369b1f79fc8e17.txt`, contents =
  the key and nothing else. Written by `scripts/generate-robots.js` from that
  same constant, so changing `KEY` is what rotates the key.

Drift between the two is a silent 403 on every submission, not an error you
will notice. Bing's form also asks for a `keyLocation`; the default is the
domain root, which is where this repo serves it, so it can be left alone.

This replaced a self-generated key (`d1353e…`, now deleted from `public/`).
Engine-issued and self-generated keys are equally valid to IndexNow — the proof
is only that the domain serves the string — but the Bing-issued one is on file
with them and checkable from their side. Keys are **per domain**: joinrepass.com
has its own in `polypass/site/seo/indexnow.mjs`. Never share one across sites.
