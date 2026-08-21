import { NextResponse } from 'next/server';
import { DOCS_PAGES } from '@/lib/dev-docs/content';
import { withMdHeader } from '@/lib/md-header';
import { SITE_URL, API_URL, MCP_URL } from '@/lib/urls';

export const runtime = 'nodejs';

/**
 * Markdown twin of /docs, the one indexed page that had none.
 *
 * /docs/llms.txt already lists the pages, but an agent that has been handed
 * https://resms.com/docs and told "append .md to any page" does not know
 * that; it gets a 404 and concludes the convention is unreliable, which costs
 * the whole surface, not this one page. Every indexed URL has a twin or the rule
 * is not a rule. This is the same list, at the address the rule predicts.
 */
export async function GET() {
  const body = `# Resms Documentation

REST API for sending and receiving SMS, verifying phone numbers, and
provisioning real US and Canada numbers.

- Base URL: ${API_URL}/v1
- Auth: \`Authorization: Bearer resms_sk_test_...\` (free sandbox keys, instant)
- MCP: ${MCP_URL} (discovery: ${SITE_URL}/.well-known/mcp.json)
- Every page below has a markdown twin: append \`.md\` to its URL.
- All of them in one file: ${SITE_URL}/docs/llms-full.txt

## Pages

${DOCS_PAGES.map((p) => `- [${p.title}](${SITE_URL}/docs/${p.slug}.md): ${p.description}`).join('\n')}
`;

  return new NextResponse(withMdHeader(body, '/docs'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
