# Delivered - SEO/AEO Implementation Roadmap

Companion to [SEO-STRATEGY.md](SEO-STRATEGY.md). Ordered by what unblocks what,
not by phase aesthetics. Items marked **[human]** cannot be done from code.

## Phase 1 - Get indexed at all (week 1)

Nothing else matters until this is done. The site is currently invisible.

| # | Task | Owner |
|---|---|---|
| 1.1 | Submit `https://deliveredsms.com/sitemap.xml` in Search Console | **[human]** |
| 1.2 | URL-inspect + request indexing for `/`, `/pricing`, `/docs`, `/login`, `/signup` | **[human]** |
| 1.3 | Publish `deliveredsms` to npm (blocked on npm web login / passkey) | **[human]** |
| 1.4 | Set the GitHub repo description + topics, and link the site from it | code/human |
| 1.5 | Verify Bing Webmaster Tools + submit the same sitemap | **[human]** |
| 1.6 | Add the 305-page gap and any missing routes to the sitemap generators | code |

Phase 1 exit: at least the five nav pages appear in `site:deliveredsms.com`.

## Phase 2 - The agent channel (weeks 2–4)

Highest leverage per hour, and the least dependent on domain authority.

| # | Task | Owner |
|---|---|---|
| 2.1 | Submit the MCP server to the public MCP registries and awesome-mcp lists | **[human]** |
| 2.2 | Publish the skills repo so `npx skills add sbier060/deliveredsms` resolves | code |
| 2.3 | Expand `/{tool}`: windsurf, cline, zed, n8n, zapier, langchain, vercel-ai-sdk | code |
| 2.4 | Add each new tool page to `llms.txt`, the sitemap, and `SITE_NAV` if primary | code |
| 2.5 | Start reporting `/api/agent-log` hits monthly - which crawlers, which paths | code |
| 2.6 | Manually check whether ChatGPT / Claude / Perplexity can answer "how do I send an SMS with Delivered" using only the live site | **[human]** |

2.6 is the real acceptance test for the whole agent surface. If an assistant
cannot get from cold start to a working `curl` using only what is published,
something is missing regardless of what the files say.

## Phase 3 - Commercial pages (weeks 4–10)

| # | Task | Owner |
|---|---|---|
| 3.1 | `/twilio-verify-alternative` - the sharpest price delta, build this first | code |
| 3.2 | `/vs/twilio` | code |
| 3.3 | `/vs/telnyx`, `/vs/plivo`, `/vs/vonage` | code |
| 3.4 | `/compare/sms-api` category hub linking all of the above | code |
| 3.5 | Per-error-code pages generated from the `/docs/errors` registry | code |
| 3.6 | Wire `COMPETITORS_CHECKED_ON` into every comparison page as a visible date | code |

Every page in this phase ships with: a `.md` twin, an `llms.txt` entry, a
sitemap entry, and a structured comparison table (tables are what answer engines
extract). None of them ship with a competitor claim we cannot substantiate.

## Phase 4 - Authority (months 3–12)

The slow part. Nothing here is a quick win and pretending otherwise wastes months.

| # | Task | Owner |
|---|---|---|
| 4.1 | Publish one original deliverability benchmark using our own delivery data | code + **[human]** |
| 4.2 | Show HN / Product Hunt / r/webdev launch | **[human]** |
| 4.3 | Get listed in Twilio-alternative directories and API marketplaces | **[human]** |
| 4.4 | Case study once a real customer exists (do not fabricate one) | **[human]** |
| 4.5 | Revisit head terms only once referring domains > 200 | - |

## Standing rules for every future page

These are the ones already violated once in this codebase and fixed:

1. **`dynamicParams = false`** on every dynamic route with `generateStaticParams`.
   Next 13.4 returns **200** from `notFound()` for unlisted params - a silent soft
   404. Only reproducible against `next build && next start`.
2. **Schema server-side in the document.** Never `next/script` +
   `afterInteractive`; crawlers do not see it.
3. **`.md` twin + `llms.txt` entry** for every new page, or the agent surface
   degrades page by page. The twin opens with the shared header from
   `src/lib/md-header.ts` (Source + Index), because a twin gets read detached
   from the site and has to be able to say which page it is a twin of. /login,
   /signup and /docs sat in the sitemap with no twin at all until 2026-08-17,
   under an llms.txt telling agents to append `.md` to any page.
4. **Titles are the page name alone.** `src/lib/metadata.ts` appends the brand;
   including it in the page title double-stamps it.
5. **Canonical must point at a URL that exists.** The homepage pointed at
   `/developers` - a 404 - for the whole life of the domain until it was caught.
6. **Every page gets an og:image.** `src/lib/metadata.ts` supplies /og.png by
   default (regenerate with `node scripts/make-og-image.js`). All 35 indexed
   pages had og:title and og:description and no image until 2026-08-17, so every
   link pasted into Slack unfurled as a grey box with a hostname.
7. **`lastmod` is a claim about the page, not about the build.**
   `scripts/lastmod.json` records a hash per URL - a doc's own block in
   `content.ts`, not the whole file - plus the date it last changed, and it is
   committed: regenerating it from scratch re-dates every page to today, which
   is the bug it replaced. Google discards lastmod it finds inconsistent with
   the page.
8. **Announce after deploying, never in postbuild.** `node scripts/indexnow.js`
   pushes changed URLs to Bing/Yandex/Seznam/Naver/DuckDuckGo once the Vercel
   deployment is Ready. At build time it would ask them to re-read the version
   you are replacing. Google does not participate; that path is still Search
   Console.

## What is explicitly not on this roadmap

- Head-term content for "sms api" - unwinnable at current authority
- Programmatic location pages - no query behind them for a developer API
- A high-cadence blog - a new domain gains nothing from volume
- Any cross-linking with joinghostapp.com - standing product decision
