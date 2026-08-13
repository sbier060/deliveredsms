import { NextResponse } from 'next/server';
import { SITE_URL, API_URL } from '@/lib/urls';
import { DOCS_PAGES } from '@/lib/dev-docs/content';

export const runtime = 'nodejs';

/**
 * Docs-only index (Resend serves one at /docs/llms.txt). The root llms.txt is
 * the whole-site map; this is the reference an agent wants when it is already
 * inside the documentation and needs the page list, nothing else.
 */
export async function GET() {
  const rows = DOCS_PAGES.map(
    (p) => `- [${p.title}](${SITE_URL}/docs/${p.slug}.md): ${p.description}`,
  ).join('\n');

  const body = `# Delivered Documentation

> REST API for sending and receiving SMS, verifying phone numbers, provisioning
> US and Canada numbers, and screening spam.

Base URL: ${API_URL}/v1
Auth: Authorization: Bearer dsms_sk_test_... (free sandbox keys, instant)

## Pages

${rows}

## Everything in one file

- ${SITE_URL}/docs/llms-full.txt

## Machine-readable

- OpenAPI (JSON): ${SITE_URL}/openapi.json
- OpenAPI (YAML): ${SITE_URL}/openapi.yaml
- Credential handling for agents: ${SITE_URL}/auth.md
- MCP discovery: ${SITE_URL}/.well-known/mcp.json
- Agent skills: ${SITE_URL}/.well-known/agent-skills/index.json

## Site map

- ${SITE_URL}/llms.txt
`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
