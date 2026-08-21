import type { Metadata } from 'next';
import Link from 'next/link';
import { generateMetadata as buildMetadata } from '@/lib/metadata';
import { DOCS_PAGES } from '@/lib/dev-docs/content';
import { SITE_URL } from '@/lib/urls';

// Was a redirect to /docs/quickstart, which meant the documentation section had
// no indexable entry point of its own and could not be drawn as a sitelink.
// It is now a real index, which is also the page an agent lands on first.
export const metadata: Metadata = buildMetadata({
  title: 'Documentation',
  description:
    'Resms API documentation: quickstart, authentication, sandbox, messages, verification, webhooks, numbers, lookup, errors, and migration guides.',
  path: '/docs',
  keywords: ['sms api documentation', 'phone verification api docs', 'resms api reference'],
});

export default function DocsIndex() {
  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-12">
      <h1 className="mb-4 text-[32px] leading-tight text-[#EFEEEC]">Documentation</h1>
      <p className="mb-10 text-[16px] leading-relaxed text-[#918E86]">
        To get started with Resms you will need a sandbox API key, which is
        free and issued the moment you{' '}
        <Link href="/signup" className="text-[#00D26A] hover:underline">
          create an account
        </Link>
        . Every endpoint works in the sandbox, webhooks included.
      </p>

      <div className="space-y-1">
        {DOCS_PAGES.map((page) => (
          <Link
            key={page.slug}
            href={`/docs/${page.slug}`}
            className="block rounded-xl border border-transparent px-4 py-4 transition-colors duration-150 hover:border-[#2E2C28] hover:bg-[#111112]"
          >
            <p className="text-[16px] text-[#EFEEEC]">{page.title}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-[#918E86]">
              {page.description}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-12 border-t border-[#2E2C28] pt-8">
        <h2 className="mb-3 text-[18px] text-[#EFEEEC]">For agents and tooling</h2>
        <ul className="space-y-2 text-[15px] leading-relaxed text-[#918E86]">
          <li>
            Every page above has a markdown twin: append <code>.md</code>, or send{' '}
            <code>Accept: text/markdown</code>.
          </li>
          <li>
            All docs in one file:{' '}
            <Link href="/docs/llms-full.txt" className="text-[#00D26A] hover:underline">
              {SITE_URL}/docs/llms-full.txt
            </Link>
          </li>
          <li>
            OpenAPI spec:{' '}
            <Link href="/openapi.json" className="text-[#00D26A] hover:underline">
              {SITE_URL}/openapi.json
            </Link>
          </li>
          <li>
            Credential handling:{' '}
            <Link href="/auth.md" className="text-[#00D26A] hover:underline">
              {SITE_URL}/auth.md
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
