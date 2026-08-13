import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { generateMetadata as buildMetadata, BASE_URL } from '@/lib/metadata';
import { AGENT_TOOLS, toolBySlug } from '@/lib/dev-docs/tools';
import Wordmark from '@/components/Wordmark';

export const dynamicParams = false;

export function generateStaticParams() {
  return AGENT_TOOLS.map(({ slug }) => ({ tool: slug }));
}

export function generateMetadata({ params }: { params: { tool: string } }): Metadata {
  const tool = toolBySlug(params.tool);
  if (!tool) return {};
  return buildMetadata({
    title: `Use Delivered with ${tool.name} — SMS & phone verification`,
    description: `Send SMS, verify phone numbers, and provision real US/Canada numbers from ${tool.name} with the Delivered. Free sandbox key, no card.`,
    path: `/${tool.slug}`,
    keywords: [
      `${tool.name.toLowerCase()} sms`,
      `${tool.name.toLowerCase()} send sms`,
      `${tool.name.toLowerCase()} phone verification`,
      'sms api for ai agents',
      'twilio alternative',
    ],
  });
}

const MONO =
  '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';

const HEADLINE =
  'text-[clamp(30px,4.5vw,44px)] leading-[1.15] tracking-[-0.02em] [text-wrap:balance]';

const CODE_BLOCK = `overflow-x-auto rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-4 text-[13px] leading-relaxed text-[#C9C6BF] ${MONO}`;

const MCP_SNIPPET = `{
  "mcpServers": {
    "ghost": {
      "url": "https://deliveredsms.com/api/mcp",
      "headers": { "Authorization": "Bearer dsms_sk_test_YOUR_KEY" }
    }
  }
}`;

const SKILLS_SNIPPET = `npx skills add sbier060/deliveredsms`;

const PROMPT_SNIPPET = `Add phone verification to signup using Delivered Verify
(POST /v1/verify, then /v1/verify/check). Docs:
https://deliveredsms.com/docs/verify.md`;

export default function ToolPage({ params }: { params: { tool: string } }) {
  const tool = toolBySlug(params.tool);
  if (!tool) notFound();

  const mcpFirst = tool.lead === 'mcp';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${BASE_URL}/${tool.slug}`,
    url: `${BASE_URL}/${tool.slug}`,
    name: `Use Delivered with ${tool.name}`,
    description: tool.pitch,
  };

  const mcpBlock = (
    <section key="mcp">
      <h2 className="text-[20px] text-[#EFEEEC]">
        {mcpFirst ? '1.' : '2.'} Connect the MCP server
      </h2>
      <p className="mt-2 max-w-[62ch] text-[15px] leading-[1.65] text-[#C9C6BF]">
        Delivered speaks Model Context Protocol. Add this to {tool.name}&apos;s MCP
        configuration and messages, verification, numbers, and lookup become
        tool calls:
      </p>
      <pre className={`mt-4 ${CODE_BLOCK}`}><code>{MCP_SNIPPET}</code></pre>
      <p className={`mt-3 text-[13px] text-[#918E86] ${MONO}`}>
        Discovery: /.well-known/mcp.json
      </p>
    </section>
  );

  const skillsBlock = (
    <section key="skills">
      <h2 className="text-[20px] text-[#EFEEEC]">
        {mcpFirst ? '2.' : '1.'} Install the skills
      </h2>
      <p className="mt-2 max-w-[62ch] text-[15px] leading-[1.65] text-[#C9C6BF]">
        Three SKILL.md files teach {tool.name} the API, the verification rules,
        and SMS compliance — so it writes correct integration code the first
        time:
      </p>
      <pre className={`mt-4 ${CODE_BLOCK}`}><code>{SKILLS_SNIPPET}</code></pre>
      <p className={`mt-3 text-[13px] text-[#918E86] ${MONO}`}>
        delivered · delivered-verify · sms-best-practices
      </p>
    </section>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="border-b border-[#2E2C28]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Wordmark />
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
          {tool.tag}
        </p>
        <h1 className={`mt-4 ${HEADLINE}`}>
          <span className="block text-[#EFEEEC]">
            Use Delivered with {tool.name}.
          </span>
          <span className="block text-[#918E86]">
            SMS, phone verification, and real numbers — as capabilities.
          </span>
        </h1>
        <p className="mt-5 max-w-[62ch] text-[16px] leading-[1.65] text-[#C9C6BF]">
          {tool.pitch}
        </p>

        <div className="mt-12 space-y-12">
          {mcpFirst ? [mcpBlock, skillsBlock] : [skillsBlock, mcpBlock]}

          <section>
            <h2 className="text-[20px] text-[#EFEEEC]">3. Ask for the feature</h2>
            <p className="mt-2 max-w-[62ch] text-[15px] leading-[1.65] text-[#C9C6BF]">
              A prompt like this now resolves against the real API, with a
              sandbox key that simulates everything and costs nothing:
            </p>
            <pre className={`mt-4 ${CODE_BLOCK}`}><code>{PROMPT_SNIPPET}</code></pre>
          </section>

          <section className="border-t border-[#2E2C28] pt-10">
            <p className="max-w-[62ch] text-[15px] leading-[1.65] text-[#C9C6BF]">
              Everything {tool.name} needs is machine-readable: an OpenAPI
              spec, markdown twins of every docs page, and a single-file
              llms.txt of the whole documentation set.
            </p>
            <ul className={`mt-4 space-y-2 text-[13px] text-[#918E86] ${MONO}`}>
              <li>/llms.txt</li>
              <li>/api/v1/openapi.yaml</li>
              <li>/docs/llms-full.txt</li>
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <Link
                href="/console"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-8 py-[15px] text-[15px] text-white transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.97]"
              >
                Get your API key — free <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/"
                className="text-[15px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
              >
                About the Delivered
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
