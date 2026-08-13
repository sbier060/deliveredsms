import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import DevFooter from '@/components/dev-docs/DevFooter';
import { generateMetadata as buildMetadata, BASE_URL } from '@/lib/metadata';
import CodeTabs from '@/components/dev-docs/CodeTabs';
import { buildSendSnippets } from '@/lib/dev-docs/snippets';
import { RATES, FREE_TIER, formatRate, formatMoney } from '@/lib/api/pricing';
import DevFunnelTracker from '@/components/dev-docs/DevFunnelTracker';
import IntegrationTiles from '@/components/dev-docs/IntegrationTiles';
import SiteHeader from '@/components/SiteHeader';

export const metadata: Metadata = buildMetadata({
  description:
    'Programmable SMS and phone numbers for developers. Send and receive texts, verify phone numbers, and provision real numbers across 200+ area codes with one REST API. Shared inbox, broadcasts, scheduled sends, and STOP handling built in.',
  path: '/',
  keywords: [
    'sms api',
    'programmable sms',
    'phone number api',
    'send sms api',
    'receive sms api',
    'phone lookup api',
    'shared sms inbox',
    'sms broadcast',
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

/** Homepage snippet set, ordered to match the tile row (Node.js first). The
 * CLI and MCP tabs are homepage-only; docs/console keep buildSendSnippets. */
function homeSnippets(): Record<string, string> {
  const base = buildSendSnippets();
  return {
    'Node.js': base['Node.js'],
    Python: base.Python,
    Ruby: base.Ruby,
    Go: base.Go,
    cURL: base.cURL,
    CLI: `# one-time: store your key (or set DELIVERED_API_KEY)
npx deliveredsms login

npx deliveredsms send --from {{FROM_NUMBER}} \\
  --to +15005550006 "Hello from Delivered"`,
    MCP: `{
  "mcpServers": {
    "delivered": {
      "url": "https://mcp.deliveredsms.com",
      "headers": { "Authorization": "Bearer {{API_KEY}}" }
    }
  }
}`,
  };
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    // These pointed at ${BASE_URL}/developers, a 404 left over from the
    // extraction - the landing page is / now.
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
    body: 'POST a message, get an ID back in milliseconds. Inbound texts hit your webhook as clean JSON: no carrier portals, no long-code paperwork.',
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
    body: "Provision local numbers across 200+ US and Canada area codes. Search by area code or prefix, purchase instantly, release when you're done, on the same provisioning engine that issues every number on the platform.",
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
    body: "Send a code, check a code: Delivered generates it, delivers it from our own verified pool, enforces expiry and attempt limits, and blocks SMS pumping. Blocked, expired, and abandoned attempts cost you nothing. Half of what Twilio Verify charges.",
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
    id: 'inbox',
    docsHref: '/docs/inbox',
    eyebrow: 'INBOX & TEAMS',
    bright: 'A shared inbox, built in.',
    muted: 'Every number, every conversation, your whole team.',
    body: 'Inbound and outbound texts thread into conversations with unread counts, contact names, and reply templates. Invite teammates with a link, keep billing and keys admin-only with roles, and see exactly who sent what.',
    endpoints: ['Conversations & unread state', 'Contacts, tags & CSV import', 'Invite links · admin & member roles'],
    visual: (
      <div className="p-5">
        <p className="mb-3 text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
          Inbox
        </p>
        <ul className="divide-y divide-[#2E2C28]">
          {[
            ['Dana Whitfield', 'Perfect, see you at 2pm.', '3', 'now'],
            ['+1 (415) 555-0176', 'Is the unit still available?', '1', '12m'],
            ['Marcus Lee', 'You: Your order shipped today.', '', '1h'],
          ].map(([name, preview, unread, when]) => (
            <li key={name} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-[#EFEEEC]">{name}</p>
                <p className="truncate text-[13px] text-[#918E86]">{preview}</p>
              </div>
              {unread && (
                <span className="rounded-full bg-[#00D26A] px-1.5 text-[11px] leading-[18px] text-black">
                  {unread}
                </span>
              )}
              <span className="text-[12px] text-[#5C5A55]">{when}</span>
            </li>
          ))}
        </ul>
        <p className={`mt-3 text-[12px] text-[#918E86] ${MONO}`}>
          sent by Maya · template: appointment-confirm
        </p>
      </div>
    ),
  },
  {
    id: 'broadcasts',
    docsHref: '/docs/broadcasts',
    eyebrow: 'BROADCASTS & SCHEDULED',
    bright: 'Message a list. Or send it later.',
    muted: 'Merge fields in, opt-outs skipped, counts out.',
    body: 'Pick a tag, write once with merge fields, and every contact gets an individual text. Anyone who replied STOP is skipped and counted, never messaged. Add scheduled_at to any send and cancel it up to the minute it goes out.',
    endpoints: ['scheduled_at on POST /v1/messages', 'broadcast.complete', '{{first_name}} merge fields'],
    visual: (
      <div className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
            Broadcast · Appointment reminders
          </p>
          <span className="rounded-full border border-[#2C2C2E] bg-[#1C1C1E] px-2.5 py-0.5 text-[11px] text-[#00D26A]">
            complete
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[#2E2C28] bg-[#2E2C28]">
          {[
            ['240', 'recipients'],
            ['236', 'sent'],
            ['4', 'skipped opt-out'],
          ].map(([value, label]) => (
            <div key={label} className="bg-[#111112] p-3">
              <p className={`text-[18px] tabular-nums text-[#EFEEEC] ${MONO}`}>{value}</p>
              <p className="mt-0.5 text-[12px] text-[#918E86]">{label}</p>
            </div>
          ))}
        </div>
        <p className={`mt-3 text-[12px] text-[#918E86] ${MONO}`}>
          Hi {'{{first_name}}'}, your appointment is tomorrow at {'{{field:time}}'}.
        </p>
      </div>
    ),
  },
  {
    id: 'opt-out',
    docsHref: '/docs/opt-out',
    eyebrow: 'COMPLIANCE',
    bright: 'STOP means stop. Automatically.',
    muted: 'CTIA keywords handled on every number.',
    body: 'Reply STOP and Delivered confirms it, blocks every future send to that person, and emits message.opted_out so your app can mirror it. START opts back in, HELP answers with your support contact, and auto-replies respect office hours and never touch keywords or verification codes.',
    endpoints: ['STOP / START / HELP', 'message.opted_out', 'Auto-reply with office hours'],
    visual: (
      <div className="space-y-3 p-5">
        <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
          Opt-out
        </p>
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-bl-md border border-[#2E2C28] px-4 py-2.5 text-[14px] text-[#C9C6BF]">
            STOP
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#1C1C1E] px-4 py-2.5 text-[14px] text-[#EFEEEC]">
            You have been unsubscribed and will receive no further messages.
            Reply START to resubscribe.
          </div>
        </div>
        <p className={`text-[12px] text-[#918E86] ${MONO}`}>
          message.opted_out · future sends blocked
        </p>
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

      {/* Slim dev nav (SITE_NAV agreement lives in SiteHeader) */}
      <SiteHeader />

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
              Delivered · SMS for developers <span aria-hidden="true">→</span>
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
              numbers, the same infrastructure behind a 400k-download consumer phone app.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <Link href="/console" className={PRIMARY_CTA}>
                Get your free API key <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/docs/quickstart"
                className="text-[15px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
              >
                Read the docs
              </Link>
            </div>
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

      {/* Pricing - deliberately this high. The first question a developer
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
              Less than half of Twilio&apos;s all-in price for the same message,
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

      {/* Integrate this afternoon - centered showcase, tiles drive the tabs */}
      <section id="code" className="border-t border-[#2E2C28]">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#00D26A]">
            Messages API
          </p>
          <h2 className={`mt-4 ${HEADLINE}`}>
            <span className="text-[#EFEEEC]">Integrate </span>
            <span className="bg-gradient-to-r from-[#00D26A] to-[#009E4F] bg-clip-text text-transparent">
              this afternoon
            </span>
            <span className="text-[#EFEEEC]">.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[58ch] text-[16px] leading-[1.65] text-[#C9C6BF]">
            A REST API that reads like documentation. Your first message is
            five lines of code, from whatever you already ship with: an SDK,
            the terminal, or your agent&apos;s MCP config.
          </p>
          <div className="mt-10">
            <IntegrationTiles />
          </div>
          <div className="mt-8 text-left">
            <CodeTabs snippets={homeSnippets()} keyAware />
          </div>
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
              Free sandbox. Instant API key.
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
