import { NextResponse } from 'next/server';
import { SITE_URL, API_URL, MCP_URL } from '@/lib/urls';
import { fullDocsMarkdown } from '@/lib/dev-docs/content';
import { TERMS_MD, PRIVACY_MD } from '@/lib/legal';
import { AGENT_TOOLS } from '@/lib/dev-docs/tools';

export const runtime = 'nodejs';

/**
 * The whole product in one fetch (Resend's root llms-full.txt): every doc page,
 * plus the legal text, plus a map of the page twins that are generated per
 * request. /docs/llms-full.txt remains the docs-only subset.
 */
export async function GET() {
  const toolLinks = AGENT_TOOLS.map(
    (t) => `- ${SITE_URL}/${t.slug}.md`,
  ).join('\n');

  const body = `# Delivered — everything in one file

> The SMS API for developers: send and receive texts, verify phone numbers,
> provision real US and Canada numbers, and screen spam with one REST API.

Base URL: ${API_URL}/v1
MCP server: ${MCP_URL}
Console: ${SITE_URL}/console
Credential handling for agents: ${SITE_URL}/auth.md
OpenAPI: ${SITE_URL}/openapi.json and ${SITE_URL}/openapi.yaml

Page twins not inlined below (each is generated per request):

- ${SITE_URL}/index.md
- ${SITE_URL}/agents.md
- ${SITE_URL}/pricing.md
${toolLinks}

---

${fullDocsMarkdown()}

---

${TERMS_MD}

---

${PRIVACY_MD}
`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
