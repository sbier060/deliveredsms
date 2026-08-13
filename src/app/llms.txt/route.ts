import { NextResponse } from 'next/server';
import { SITE_URL, API_URL, MCP_URL } from '@/lib/urls';
import { DOCS_PAGES } from '@/lib/dev-docs/content';

export const runtime = 'nodejs';

const BASE = SITE_URL;

export async function GET() {
  const docsLines = DOCS_PAGES.map(
    (p) => `- [${p.title}](${BASE}/docs/${p.slug}.md): ${p.description}`
  ).join('\n');

  const body = `# Delivered — SMS for Developers

> The SMS API for developers: send and receive texts, verify phone numbers,
> and provision real US and Canada numbers with one REST API.
> Sandbox keys are free and instant; every endpoint works in test mode.

Base URL: https://api.deliveredsms.com/v1
Auth: Authorization: Bearer dsms_sk_test_... (free sandbox keys, instant)
Console: ${BASE}/console

## Authentication
- [How to get and handle credentials (agents start here)](${BASE}/auth.md)

## Markdown twins of site pages
- [Landing (Markdown)](${BASE}/index.md)
- [Agents page (Markdown)](${BASE}/agents.md)
- [Pricing (Markdown)](${BASE}/pricing.md)
- **Per-tool pages** - append .md to any tool page, e.g. ${BASE}/claude-code.md
- Every page also supports \`Accept: text/markdown\` content negotiation.

## Documentation
- [Docs index](${BASE}/docs/llms.txt)
- [Full documentation (single file)](${BASE}/docs/llms-full.txt)
- [Everything on this site in one file](${BASE}/llms-full.txt)
${docsLines}

## Migrating from another provider
- [Migration index](${BASE}/migrate.md)

## Command line tool
- **CLI**: \`npx deliveredsms\` — send, verify, numbers, lookup, events from the terminal; --json for scripts and agents; key via DELIVERED_API_KEY or \`deliveredsms login\`

## SDKs
- **Node.js / TypeScript**: \`npm install deliveredsms\` — zero dependencies, works on Node 18+, Bun, Deno, Workers and Edge; ships the CLI as its bin

## OpenAPI spec
- [OpenAPI spec (YAML)](${BASE}/openapi.yaml)
- [OpenAPI spec (JSON)](${BASE}/openapi.json)
- Also served from the API host at ${API_URL}/v1/openapi.yaml and ${API_URL}/v1/openapi.json

## MCP Server
- [Streamable HTTP MCP server](${BASE}/api/mcp): send/receive SMS, numbers, lookup, and events as MCP tools; authenticate with your API key
- [MCP Discovery](${BASE}/.well-known/mcp.json)

## Skills
- **Install**: \`npx skills add sbier060/deliveredsms\` — works with Claude Code, Cursor, Codex, Devin, Copilot
- [Repository](https://github.com/sbier060/deliveredsms)
- [Skills Discovery](${BASE}/.well-known/agent-skills/index.json)
- [delivered](${BASE}/skills/delivered/SKILL.md): send and receive SMS, get numbers
- [delivered-verify](${BASE}/skills/delivered-verify/SKILL.md): phone verification (OTP/2FA) in two calls
- [sms-best-practices](${BASE}/skills/sms-best-practices/SKILL.md): consent, opt-out, segments, 10DLC

## For AI agents
- [Agents overview](${BASE}/agents): phone numbers, SMS inboxes, and verification for agents
- [Use Delivered with Claude](${BASE}/claude)
- [Use Delivered with Claude Code](${BASE}/claude-code)
- [Use Delivered with Cursor](${BASE}/cursor)
- [Use Delivered with Codex](${BASE}/codex)
- [Use Delivered with Devin](${BASE}/devin)
- [Use Delivered with GitHub Copilot](${BASE}/copilot)

## Changelog
- [Changelog (Markdown)](${BASE}/changelog.md)
- [Changelog (HTML)](${BASE}/docs/changelog)

## Legal
- [Terms of Service](${BASE}/terms.md): operated by Truelabel LLC. HTML at ${BASE}/terms
- [Privacy Policy](${BASE}/privacy.md): HTML at ${BASE}/privacy

## Product
- [Landing page](${BASE})
- [Pricing (HTML)](${BASE}/pricing)
- [Pricing (Markdown)](${BASE}/pricing.md)
`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
