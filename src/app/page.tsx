import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import DevFooter from '@/components/dev-docs/DevFooter';
import { generateMetadata as buildMetadata, BASE_URL } from '@/lib/metadata';
import CodeTabs from '@/components/dev-docs/CodeTabs';
import { buildSendSnippets } from '@/lib/dev-docs/snippets';
import { RATES, FREE_TIER, formatRate, formatMoney } from '@/lib/api/pricing';
import DevFunnelTracker from '@/components/dev-docs/DevFunnelTracker';
import Wordmark from '@/components/Wordmark';

export const metadata: Metadata = buildMetadata({
  description:
    'Programmable SMS and phone numbers for developers. Send and receive texts, verify phone numbers, and provision real numbers across 200+ area codes with one REST API.',
  path: '/',
  keywords: [
    'sms api',
    'programmable sms',
    'phone number api',
    'send sms api',
    'receive sms api',
    'phone lookup api',
    'twilio alternative',
  ],
});

const MONO =
  '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';

const HEADLINE =
  'text-[clamp(30px,4.5vw,44px)] leading-[1.15] tracking-[-0.02em] [text-wrap:balance]';

const PRIMARY_CTA =
  'inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-8 py-[15px] text-[15px] text-white transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.97]';

const CODE_CHIP = `rounded-md border border-[#2C2C2E] bg-[#1C1C1E] px-1.5 py-0.5 text-[13px] text-[#C9C6BF] ${MONO}`;

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    // These pointed at ${BASE_URL}/developers, a 404 left over from the
    // extraction — the landing page is / now.
    {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/#webpage`,
      url: BASE_URL,
      name: 'Delivered · SMS for developers',
      description:
        'Programmable SMS and phone numbers for developers. Send and receive texts, verify phone numbers, and provision real numbers with one REST API.',
      isPartOf: { '@id': `${BASE_URL}/#website` },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Delivered',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
      url: BASE_URL,
      provider: { '@id': `${BASE_URL}/#organization` },
    },
  ],
};

const featureSections = [
  {
    id: 'send-receive',
    docsHref: '/docs/messages',
    eyebrow: 'SEND & RECEIVE',
    bright: 'Two-way SMS at scale.',
    muted: 'One endpoint to send, one webhook to receive.',
    body: 'POST a message, get an ID back in milliseconds. Inbound texts hit your webhook as clean JSON — no carrier portals, no long-code paperwork.',
    endpoints: ['POST /v1/messages', 'GET /v1/messages/:id', 'POST /v1/test/inbound'],
    visual: (
      <div className="space-y-3 p-5">
        <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
          Conversation
        </p>
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#1C1C1E] px-4 py-2.5 text-[14px] text-[#EFEEEC]">
            Your table is ready. Reply YES to confirm.
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-[#2E2C28] px-4 py-2.5 text-[14px] text-[#C9C6BF]">
            YES
          </div>
        </div>
        <p className={`text-[12px] text-[#918E86] ${MONO}`}>
          message.received · 214ms · webhook 200 OK
        </p>
      </div>
    ),
  },
  {
    id: 'numbers',
    docsHref: '/docs/numbers',
    eyebrow: 'NUMBERS',
    bright: 'Real numbers, on demand.',
    muted: 'Search, buy, and release in one call.',
    body: "Provision local numbers across 200+ US and Canada area codes. Search by area code or prefix, purchase instantly, release when you're done — the same provisioning engine that issues every number on the platform.",
    endpoints: [
      'GET /v1/numbers/available?area_code=415',
      'POST /v1/numbers',
      'DELETE /v1/numbers/:id',
    ],
    visual: (
      <div className="p-5">
        <p className="mb-3 text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
          Available · 415
        </p>
        <ul className="divide-y divide-[#2E2C28]">
          {[
            ['+1 (415) 555-0132', 'San Francisco, CA'],
            ['+1 (415) 555-0176', 'San Francisco, CA'],
            ['+1 (415) 555-0198', 'Sausalito, CA'],
          ].map(([number, city]) => (
            <li
              key={number}
              className="flex items-center justify-between py-2.5"
            >
              <span className={`text-[14px] text-[#EFEEEC] ${MONO}`}>
                {number}
              </span>
              <span className="text-[13px] text-[#918E86]">{city}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'verify',
    docsHref: '/docs/verify',
    eyebrow: 'VERIFY',
    bright: 'Phone verification in two calls.',
    muted: 'No number to buy. Billed only on success.',
    body: "Send a code, check a code — Delivered generates it, delivers it from our own verified pool, enforces expiry and attempt limits, and blocks SMS pumping. Blocked, expired, and abandoned attempts cost you nothing. Half of what Twilio Verify charges.",
    endpoints: ['POST /v1/verify', 'POST /v1/verify/check'],
    visual: (
      <div className="p-5">
        <p className="mb-3 text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
          Verification
        </p>
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-[#2E2C28] px-4 py-2.5 text-[14px] text-[#C9C6BF]">
            Acme code: 482193. It expires in 10 minutes. Don&apos;t share it.
          </div>
        </div>
        <pre
          className={`mt-4 overflow-x-auto text-[13px] leading-relaxed text-[#918E86] ${MONO}`}
        >{`{
  "verified": true,
  "status": "approved",
  "charged": true
}`}</pre>
      </div>
    ),
  },
  {
    id: 'events',
    docsHref: '/docs/sandbox',
    eyebrow: 'EVENTS',
    bright: 'Webhooks you can trust.',
    muted: 'Signed, retried, and observable.',
    body: 'Delivery receipts and inbound messages arrive as signed webhook events with automatic retries. Replay any event from the dashboard when your endpoint has a bad day.',
    endpoints: ['message.delivered', 'message.received', 'number.purchased'],
    visual: (
      <div>
        <div className="border-b border-[#2C2C2E] bg-[#0A0A0B] px-4 py-2">
          <span className="text-[11px] uppercase tracking-[0.04em] text-[#8E8E93]">
            event · message.delivered
          </span>
        </div>
        <pre
          className={`overflow-x-auto p-4 text-[13px] leading-relaxed text-[#918E86] ${MONO}`}
        >{`{
  "type": "message.delivered",
  "id": "evt_8f2k41",
  "data": {
    "message_id": "msg_j29dk1",
    "to": "+16285550107",
    "status": "delivered",
    "latency_ms": 212
  }
}`}</pre>
      </div>
    ),
  },
];

const stats = [
  ['400,000+', 'downloads'],
  ['200+', 'area codes live'],
  ['Millions', 'of calls screened'],
  ['99.9%', 'delivery uptime'],
];

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DevFunnelTracker event="API Landing Viewed" />

      {/* Slim dev nav */}
      <header className="border-b border-[#2E2C28]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-6">
            {/* These four are SITE_NAV in src/lib/site-schema.ts. Google draws
                sitelinks from real, linked, indexable nav destinations, so the
                schema and this markup have to agree. */}
            <Link
              href="/docs"
              className="hover-underline-gradient hidden text-[14px] text-[#918E86] transition-colors duration-150 hover:text-[#EFEEEC] sm:block"
            >
              Docs
            </Link>
            <Link
              href="/pricing"
              className="hover-underline-gradient hidden text-[14px] text-[#918E86] transition-colors duration-150 hover:text-[#EFEEEC] sm:block"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="hover-underline-gradient hidden text-[14px] text-[#918E86] transition-colors duration-150 hover:text-[#EFEEEC] sm:block"
            >
              Log in
            </Link>
            <Link
              href="/console"
              className="rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86]"
            >
              Console
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="hero-glow pointer-events-none absolute inset-0"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl items-center px-6 pb-20 pt-16 lg:grid lg:grid-cols-[1fr_380px] lg:gap-16 lg:pt-24">
          <div>
            <a
              href="#code"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#2E2C28] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#00D26A] transition-colors duration-150 hover:border-[#918E86]"
            >
              Delivered — Early Access <span aria-hidden="true">→</span>
            </a>
            <h1 className={`mt-6 ${HEADLINE}`}>
              <span className="block text-[#EFEEEC]">SMS for developers.</span>
              <span className="block text-[#918E86]">
                Send, receive, and provision real numbers with one API.
              </span>
            </h1>
            <p className="mt-5 max-w-[62ch] text-[16px] leading-[1.65] text-[#C9C6BF]">
              The best way to reach people where they actually look.
              Programmable messaging, phone verification, and on-demand phone
              numbers — the same infrastructure behind a 400k-download consumer phone app.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <Link href="/console" className={PRIMARY_CTA}>
                Get your API key — free <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/docs/quickstart"
                className="text-[15px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
              >
                Read the docs
              </Link>
            </div>
            <p className="mt-4 text-[13px] text-[#918E86]">
              No card. No sales call. Sandbox key in 60 seconds.
            </p>
          </div>

          {/* Live events card (Resend's cube analog) */}
          <div className="hidden lg:block">
            <div className="rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-5">
              <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
                Live events
              </p>
              <ul
                className={`mt-4 space-y-3 text-[13px] text-[#C9C6BF] ${MONO}`}
              >
                <li>message.delivered · +1 (415) •••-••41 · 212ms</li>
                <li>number.purchased · +1 (628) •••-••07</li>
                <li>message.received · +1 (917) •••-••88</li>
                <li>verification.approved · +1 (305) •••-••19 · 1.4s</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing — deliberately this high. The first question a developer
          comparing us to Twilio has is "what does it cost", and rates are
          imported from pricing.ts so this strip can never drift from what
          billing actually charges. */}
      <section id="pricing" className="border-t border-[#2E2C28]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#00D26A]">
            Pricing
          </p>
          <h2 className={`mt-4 ${HEADLINE}`}>
            <span className="block text-[#EFEEEC]">
              Pay for what you send. Nothing else.
            </span>
            <span className="block text-[#918E86]">
              No platform fee, no commitments, no sales call.
            </span>
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#2E2C28] bg-[#2E2C28] md:grid-cols-4">
            {[
              {
                value: formatRate(RATES.outbound_sms.microUsd),
                unit: 'per SMS sent',
                note: `Inbound ${formatRate(RATES.inbound_sms.microUsd)}`,
              },
              {
                value: formatRate(RATES.verifications.microUsd),
                unit: 'per verification',
                note: 'Only when the code is verified',
              },
              {
                value: `${formatMoney(RATES.numbers.microUsd)}/mo`,
                unit: 'per phone number',
                note: '10DLC registration included',
              },
              {
                value: 'Free',
                unit: 'to start',
                note: `${FREE_TIER.outboundSmsPerMonth} texts + ${FREE_TIER.verificationsPerMonth} verifications/mo, no card`,
              },
            ].map(({ value, unit, note }) => (
              <div key={unit} className="bg-[#0F0E0C] p-6">
                <p
                  className={`text-[26px] tabular-nums leading-tight text-[#EFEEEC] ${MONO}`}
                >
                  {value}
                </p>
                <p className="mt-1 text-[14px] text-[#C9C6BF]">{unit}</p>
                <p className="mt-2 text-[13px] leading-snug text-[#918E86]">
                  {note}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <p className="text-[14px] text-[#918E86]">
              Less than half of Twilio&apos;s all-in price for the same message —
              carrier fees included, not added on top.
            </p>
            <Link
              href="/pricing"
              className="text-[14px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
            >
              Full pricing &amp; calculator
            </Link>
          </div>
        </div>
      </section>

      {/* Integrate this afternoon */}
      <section id="code" className="border-t border-[#2E2C28]">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[minmax(0,420px)_1fr]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#00D26A]">
              Messages API
            </p>
            <h2 className={`mt-4 ${HEADLINE}`}>
              <span className="block text-[#EFEEEC]">
                Integrate this afternoon.
              </span>
              <span className="block text-[#918E86]">
                Your first message is five lines of code.
              </span>
            </h2>
            <p className="mt-5 max-w-[62ch] text-[15px] leading-[1.65] text-[#C9C6BF]">
              A REST API that reads like documentation. Official SDKs planned
              for every stack you already ship — start with a key and an HTTP
              call.
            </p>
            <p className={`mt-6 text-[13px] text-[#918E86] ${MONO}`}>
              Node.js · Python · Ruby · Go · REST
            </p>
          </div>
          <CodeTabs snippets={buildSendSnippets()} keyAware />
        </div>
      </section>

      {/* Feature sections */}
      {featureSections.map((feature, index) => {
        const visualLeft = index % 2 === 1;
        return (
          <section
            key={feature.id}
            id={feature.id}
            className="border-t border-[#2E2C28]"
          >
            <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2">
              <div className={visualLeft ? 'md:order-2' : ''}>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#00D26A]">
                  {feature.eyebrow}
                </p>
                <h2 className={`mt-4 ${HEADLINE}`}>
                  <span className="block text-[#EFEEEC]">{feature.bright}</span>
                  <span className="block text-[#918E86]">{feature.muted}</span>
                </h2>
                <p className="mt-5 max-w-[62ch] text-[15px] leading-[1.65] text-[#C9C6BF]">
                  {feature.body}
                </p>
                <ul className="mt-6 space-y-2.5">
                  {feature.endpoints.map((endpoint) => (
                    <li key={endpoint}>
                      <code className={CODE_CHIP}>{endpoint}</code>
                    </li>
                  ))}
                </ul>
                <Link
                  href={feature.docsHref}
                  className="mt-5 inline-block text-[14px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
                >
                  Read the docs
                </Link>
              </div>
              <div className={visualLeft ? 'md:order-1' : ''}>
                <div className="overflow-hidden rounded-xl border border-[#2E2C28] bg-[#0F0E0C]">
                  {feature.visual}
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {/* Stats strip */}
      <section className="border-t border-[#2E2C28]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-[12px] uppercase tracking-[0.14em] text-[#918E86]">
            Battle-tested by a 400k-download consumer phone app
          </p>
          <div className="mt-8 grid grid-cols-2 gap-10 md:grid-cols-4">
            {stats.map(([value, label]) => (
              <div key={label}>
                <p className="text-[28px] tabular-nums leading-tight text-[#EFEEEC]">
                  {value}
                </p>
                <p className="mt-1 text-[14px] text-[#918E86]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-[#2E2C28]">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 className={HEADLINE}>
            <span className="block text-[#EFEEEC]">
              Ship SMS without the carrier maze.
            </span>
            <span className="block text-[#918E86]">
              Early access is open now.
            </span>
          </h2>
          <p className="mt-5 max-w-[62ch] text-[16px] leading-[1.65] text-[#C9C6BF]">
            Create a free account, get a sandbox key instantly, and send your
            first test message before your coffee cools.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Link href="/console" className={PRIMARY_CTA}>
              Start building <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/agents"
              className="text-[15px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
            >
              Building an AI agent?
            </Link>
          </div>
        </div>
      </section>

      <DevFooter />
    </div>
  );
}
