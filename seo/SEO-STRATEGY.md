# Delivered — SEO & AEO Strategy

_Written 2026-08-13. Domain age at writing: 1 day._

## The honest starting position

| | Delivered | Twilio | Telnyx | Plivo |
|---|---|---|---|---|
| Domain age | 1 day | 18 years | 16 years | 13 years |
| Referring domains | 0 | ~500,000 | ~30,000 | ~15,000 |
| Indexed | no | yes | yes | yes |

Head terms — "sms api", "programmable sms", "phone verification api" — are not
winnable in year one. Any plan that leads with them is a plan to spend twelve
months losing. This document assumes we do not compete on authority, because we
cannot, and instead compete where authority is not the ranking input.

**One structural constraint:** the API product and the consumer product
(joinghostapp.com) must not cross-link — that is a standing product decision, and
it is enforced in `src/components/dev-docs/DevFooter.tsx`. So the established
domain cannot pass authority to the new one. The obvious shortcut is closed on
purpose; nothing in this plan assumes it.

## Where we actually win

### 1. AEO / the agent channel — the priority

An answer engine picking a citation weighs "is this machine-readable, specific,
and unambiguous" far more heavily than "is this domain 18 years old". A one-day-old
domain with a complete `llms.txt`, an OpenAPI spec at the conventional path, and
markdown twins of every page is *more* citable than a competitor whose docs are
locked behind a JS-rendered SPA.

This is the one channel where being new is close to free. It is also the channel
our buyer literally lives in: developers now ask Claude, Cursor, and ChatGPT
"what SMS API should I use", and increasingly let the agent do the integration.
Already shipped: `/llms.txt`, `/llms-full.txt`, `/docs/llms.txt`, `/auth.md`,
`/openapi.{json,yaml}`, `.well-known/mcp.json`, `.well-known/agent-skills/index.json`,
three `SKILL.md` files, and a `.md` twin of every page.

**The gap is distribution, not surface.** An MCP server nobody has installed and
a skill nobody has added are invisible. Getting `deliveredsms` into the MCP
registries, the skills directories, and the "awesome-mcp" style lists matters more
than any further on-page work.

### 2. Comparison and alternative pages

The highest-converting SaaS page type (4–7% vs 0.5–1.8% for blog content), and
the queries carry commercial intent from people who have already decided to
switch. They also rank on relevance and specificity far more than on domain
authority, because the query is long and the intent is narrow.

We have a genuinely sharp edge to build them on: verification is billed only on
success, and 10DLC registration is included rather than a separate brand fee.
That is a concrete, checkable claim — which is exactly what these pages need, and
exactly what AI answer engines quote.

Target set, in priority order:

| Page | Query intent |
|---|---|
| `/vs/twilio` | "delivered vs twilio", "twilio alternative" |
| `/twilio-verify-alternative` | the sharpest price delta we have |
| `/vs/telnyx`, `/vs/plivo`, `/vs/vonage` | switcher queries |
| `/compare/sms-api` | category hub |

Existing `/docs/migrate-from-twilio` is the technical half of this and should be
cross-linked from each.

**Accuracy is a hard requirement.** Competitor pricing changes; a stale table is
both a credibility problem and a legal one. Every comparison page must carry a
"last checked" date sourced from `COMPETITORS_CHECKED_ON` in `src/lib/api/pricing.ts`,
the way `/pricing` already does. Nominative fair use covers naming competitors;
it does not cover claims we cannot substantiate.

### 3. The `/{tool}` pages

`/claude`, `/claude-code`, `/cursor`, `/codex`, `/devin`, `/copilot` already
exist. This is a young, low-competition query space ("send sms from cursor",
"claude code sms mcp") that our competitors have largely not entered, and it is
the natural landing page for the agent channel above. Expand rather than start
over: Windsurf, Cline, Zed, n8n, Zapier, LangChain, Vercel AI SDK.

### 4. Long-tail developer queries via docs

Twelve doc pages, each already an indexable page with its own title and
description. Error-code pages in particular capture high-intent searches
("dsms invalid_api_key", "sms api 429 retry-after") from developers already
integrating. Cheap to expand: one page per error code, generated from the same
registry `/docs/errors` renders.

## Where we do not play

- **Head terms.** "sms api" and friends. Revisit at 200+ referring domains.
- **Programmatic location pages.** The consumer property does this at ~12k pages
  and it fits there. For a developer API it would be thin content with no query
  behind it.
- **Volume blogging.** A new domain publishing three generic posts a week builds
  nothing. One genuinely original piece — a real deliverability benchmark with
  our own data — is worth more than fifty.

## Technical foundation

Already in place: `Brand · Tagline` homepage title, Organization + WebSite +
SiteNavigationElement schema server-rendered in `<head>`, an indexable page behind
every nav destination, clean canonicals, sitemap index, `robots.txt` allowing all
crawlers except `/console` and internal APIs.

Standing rules for anything added later:

- Every new dynamic route needs `dynamicParams = false` alongside
  `generateStaticParams`. On Next 13.4 `notFound()` answers **200** for an
  unlisted param, which silently creates soft 404s. Verify against
  `next build && next start`, never `next dev`.
- Every new page needs a `.md` twin and an entry in `llms.txt`. The agent surface
  is only as good as its worst-covered page.
- Schema goes server-side in the document. `next/script` with
  `strategy="afterInteractive"` means crawlers never see it — that is exactly how
  the consumer site's FAQPage schema became invisible.
- Titles are the page name alone; `src/lib/metadata.ts` appends the brand.

## KPI targets

Deliberately modest, because the domain is one day old and anything else is
fiction.

| Metric | Now | 3 mo | 6 mo | 12 mo |
|---|---|---|---|---|
| Indexed pages | 0 | 40 | 80 | 150 |
| Referring domains | 0 | 15 | 50 | 150 |
| Organic sessions / mo | 0 | 200 | 1,500 | 8,000 |
| Signups from organic / mo | 0 | 10 | 75 | 400 |
| AI citations tracked / mo | 0 | 5 | 40 | 200 |
| MCP/skill installs | 0 | 50 | 400 | 2,500 |
| Brand-query impressions | 0 | 100 | 1,000 | 10,000 |
| Sitelinks on brand SERP | no | no | maybe | likely |

Sitelinks are algorithmic. They need brand-query volume, not markup — the markup
is done. The `Brand-query impressions` row is the leading indicator for that
last row; nothing else moves it.

## Measurement

- **Search Console** for classic search. Property is verified; sitemap needs
  submitting.
- **AI citations** are not in GSC. The site logs AI crawler hits server-side via
  `/api/agent-log` (the `AGENT_UA` matcher in `src/middleware.ts`) — that is the
  closest thing to an AEO analytics feed we have, and it should be reported on
  monthly alongside GSC.
- **Comparison pages** get tracked on conversion, not rank. Rank without signups
  on a `/vs/` page means the page is wrong.
