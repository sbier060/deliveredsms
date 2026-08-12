import Link from 'next/link';
import type { Metadata } from 'next';
import { generateMetadata as buildMetadata, BASE_URL } from '@/lib/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Phone numbers and SMS for AI agents — OpenSMS',
  description:
    'Give your AI agent a real phone number. Send and receive SMS, run phone verification, and screen spam — with an API, MCP server, and skills built for agents.',
  path: '/agents',
  keywords: [
    'sms for ai agents',
    'phone number for ai agent',
    'agent sms api',
    'ai agent otp verification',
    'mcp sms server',
  ],
});

const MONO =
  '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';

const HEADLINE =
  'text-[clamp(30px,4.5vw,44px)] leading-[1.15] tracking-[-0.02em] [text-wrap:balance]';

const CODE_BLOCK = `overflow-x-auto rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-4 text-[13px] leading-relaxed text-[#C9C6BF] ${MONO}`;

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': `${BASE_URL}/agents`,
  url: `${BASE_URL}/agents`,
  name: 'Phone numbers and SMS for AI agents',
  description:
    'Real phone numbers, two-way SMS, and phone verification for AI agents, via REST, MCP, and agent skills.',
};

const capabilities = [
  {
    title: 'A real phone number of its own',
    body: 'Provision a US or Canada number in one call. Your agent can hold it, text from it, and release it when the job is done — $0.95 a month, 10DLC registration included.',
    code: 'POST /v1/numbers  { "phone_number": "+14155550132" }',
  },
  {
    title: 'An SMS inbox it can act on',
    body: 'Inbound texts land as clean JSON events. An agent can poll /v1/events or take a webhook, read the message, and decide what to do next — confirmations, replies, hand-offs.',
    code: 'GET /v1/events?type=message.received',
  },
  {
    title: 'Phone verification as a primitive',
    body: 'When an agent signs something up, the OTP flow is two calls. OpenSMS generates and delivers the code, enforces expiry and attempts, and blocks SMS pumping. Billed only on success.',
    code: 'POST /v1/verify → POST /v1/verify/check',
  },
  {
    title: 'Judgment about who is calling',
    body: 'Before an agent trusts a number, one lookup returns line type, carrier, and a spam score built from millions of screened calls in the consumer phone app.',
    code: 'GET /v1/lookup/+14155550132/spam',
  },
];

export default function AgentsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="border-b border-[#2E2C28]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[16px] text-[#EFEEEC]">Open</span>
            <span className="text-[16px] text-[#00D26A]">SMS</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/docs/quickstart"
              className="hidden text-[14px] text-[#918E86] transition-colors duration-150 hover:text-[#EFEEEC] sm:block"
            >
              Docs
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

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#00D26A]">
          For AI agents
        </p>
        <h1 className={`mt-4 ${HEADLINE}`}>
          <span className="block text-[#EFEEEC]">
            Give your agent a phone number.
          </span>
          <span className="block text-[#918E86]">
            The phone layer for software that acts on its own.
          </span>
        </h1>
        <p className="mt-5 max-w-[62ch] text-[16px] leading-[1.65] text-[#C9C6BF]">
          Agents keep hitting the same wall: the real world runs on phone
          numbers. Signups want SMS verification. People reply by text.
          Unknown callers need screening. OpenSMS turns all of that into API
          calls an agent can make.
        </p>

        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-[#2E2C28] bg-[#2E2C28] md:grid-cols-2">
          {capabilities.map(({ title, body, code }) => (
            <div key={title} className="bg-[#0F0E0C] p-7">
              <h2 className="text-[18px] text-[#EFEEEC]">{title}</h2>
              <p className="mt-3 text-[14px] leading-[1.65] text-[#C9C6BF]">
                {body}
              </p>
              <p className={`mt-4 text-[13px] text-[#00D26A] ${MONO}`}>{code}</p>
            </div>
          ))}
        </div>

        <section className="mt-16">
          <h2 className="text-[20px] text-[#EFEEEC]">
            Built to be used by agents, not just humans
          </h2>
          <p className="mt-2 max-w-[62ch] text-[15px] leading-[1.65] text-[#C9C6BF]">
            Every surface has a machine-readable form: an MCP server for tool
            calls, skills that encode the integration rules, markdown twins of
            every docs page, and a sandbox where test keys simulate the whole
            carrier so agents can iterate for free.
          </p>
          <pre className={`mt-5 ${CODE_BLOCK}`}><code>{`MCP     https://opensms.dev/api/mcp
Skills  npx skills add sbier060/ghost-skills
Docs    https://opensms.dev/docs/llms-full.txt
Spec    https://api.opensms.dev/v1/openapi.yaml`}</code></pre>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Link
              href="/console"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-8 py-[15px] text-[15px] text-white transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.97]"
            >
              Get your API key — free <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/pricing"
              className="text-[15px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
            >
              Pricing
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
