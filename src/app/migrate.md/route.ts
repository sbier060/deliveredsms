import { NextResponse } from 'next/server';
import { withMdHeader } from '@/lib/md-header';
import { SITE_URL, API_URL } from '@/lib/urls';
import { DOCS_PAGES } from '@/lib/dev-docs/content';

export const runtime = 'nodejs';

/**
 * Index of the migration guides (Resend's /migrate.md shape). Built from
 * DOCS_PAGES so a new migrate-from-* guide shows up here automatically.
 */
export async function GET() {
  const guides = DOCS_PAGES.filter((p) => p.slug.startsWith('migrate-from-'));
  const rows = guides
    .map((p) => `- **${p.title}** - ${SITE_URL}/docs/${p.slug}.md: ${p.description}`)
    .join('\n');

  const body = `# Migrating to Delivered

Moving from another SMS or verification provider. Each guide maps the old API's
calls, parameters, and webhooks onto Delivered's, endpoint by endpoint.

${rows || '- No migration guides published yet.'}

## What is the same everywhere

- Base URL: \`${API_URL}/v1\`
- Auth: \`Authorization: Bearer dsms_sk_test_...\` (sandbox keys are free and instant)
- Test first: every endpoint works against the sandbox, including webhooks, so a
  migration can be built and verified before a single live message is sent.
- Credential handling for agents: ${SITE_URL}/auth.md
- Full API reference: ${SITE_URL}/openapi.json

## If your provider is not listed

The API surface is small enough to map by hand: messages, verify, numbers,
lookup, and events. Start at ${SITE_URL}/docs/quickstart.md and check
${SITE_URL}/docs/errors.md for the error envelope.
`;

  return new NextResponse(withMdHeader(body, '/docs/migrate-from-twilio'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
