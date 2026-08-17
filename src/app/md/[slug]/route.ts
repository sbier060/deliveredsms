import { NextResponse } from 'next/server';
import { withMdHeader } from '@/lib/md-header';
import { AGENT_TOOLS, toolBySlug } from '@/lib/dev-docs/tools';
import { SITE_URL, API_URL, MCP_URL } from '@/lib/urls';
import { RATES, FREE_TIER, formatRate, formatMoney } from '@/lib/api/pricing';

export const runtime = 'nodejs';

/**
 * Markdown twins for the pages that aren't docs: the landing page, /agents,
 * and every /[tool] page. "Serve a markdown version of every page" - agents
 * reading HTML burn tokens on markup; these are what the middleware serves
 * when a client asks for text/markdown (or hits /<page>.md directly).
 */

const md = (body: string) =>
  new NextResponse(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });

function landingMd(): string {
  return `# Delivered · SMS for Developers

Send and receive texts, verify phone numbers, and provision real US/Canada
numbers with one REST API. The same rates for everyone: ${formatRate(RATES.outbound_sms.microUsd)}/SMS,
${formatRate(RATES.verifications.microUsd)}/verification (charged only on success), ${formatMoney(RATES.numbers.microUsd)}/mo numbers
with 10DLC included. Free tier: ${FREE_TIER.outboundSmsPerMonth} texts + ${FREE_TIER.verificationsPerMonth} verifications/month, no card.

- Base URL: ${API_URL}/v1 (Bearer dsms_sk_...)
- Console (free sandbox key, instant): ${SITE_URL}/console
- Docs: ${SITE_URL}/docs; every page has a .md twin; llms-full at ${SITE_URL}/docs/llms-full.txt
- llms.txt: ${SITE_URL}/llms.txt
- MCP: ${MCP_URL} (discovery: ${SITE_URL}/.well-known/mcp.json)
- Skills: npx skills add sbier060/deliveredsms
- SDK + CLI: npm install deliveredsms; try \`npx deliveredsms verify +14155550132\`
- Pricing (markdown): ${SITE_URL}/pricing.md
`;
}

function agentsMd(): string {
  return `# Phone numbers and SMS for AI agents · Delivered

Agents keep hitting the same wall: the real world runs on phone numbers.
Delivered turns that into API calls an agent can make.

- **A real phone number of its own**: POST /v1/numbers, ${formatMoney(RATES.numbers.microUsd)}/mo, 10DLC included.
- **An SMS inbox it can act on**: inbound texts as JSON via GET /v1/events.
- **Phone verification as a primitive**: POST /v1/verify then /v1/verify/check; billed only on success.
- **Know what kind of number it is**: GET /v1/lookup/{phone}, line type and carrier before it sends.

Machine-readable everything:
- MCP: ${MCP_URL}
- Skills: npx skills add sbier060/deliveredsms
- Docs (single file): ${SITE_URL}/docs/llms-full.txt
- OpenAPI: ${API_URL}/v1/openapi.yaml

Free sandbox key, instant, no card: ${SITE_URL}/console
`;
}

function toolMd(slug: string): string | null {
  const tool = toolBySlug(slug);
  if (!tool) return null;
  const lead =
    tool.lead === 'mcp'
      ? `## 1. Connect the MCP server\n\nAdd to ${tool.name}'s MCP configuration:\n\n\`\`\`json\n{ "mcpServers": { "delivered": { "url": "${MCP_URL}", "headers": { "Authorization": "Bearer dsms_sk_test_YOUR_KEY" } } } }\n\`\`\`\n\n## 2. Install the skills\n\n\`\`\`bash\nnpx skills add sbier060/deliveredsms\n\`\`\``
      : `## 1. Install the skills\n\n\`\`\`bash\nnpx skills add sbier060/deliveredsms\n\`\`\`\n\n## 2. Connect the MCP server\n\n\`\`\`json\n{ "mcpServers": { "delivered": { "url": "${MCP_URL}", "headers": { "Authorization": "Bearer dsms_sk_test_YOUR_KEY" } } } }\n\`\`\``;
  return `# Use Delivered with ${tool.name}

${tool.pitch}

${lead}

## 3. Ask for the feature

"Add phone verification to signup using Delivered Verify (POST /v1/verify,
then /v1/verify/check). Docs: ${SITE_URL}/docs/verify.md"

Everything ${tool.name} needs is machine-readable: ${SITE_URL}/llms.txt ·
${API_URL}/v1/openapi.yaml · ${SITE_URL}/docs/llms-full.txt

Free sandbox key: ${SITE_URL}/console
`;
}

export function generateStaticParams() {
  return [
    { slug: 'index' },
    { slug: 'agents' },
    ...AGENT_TOOLS.map(({ slug }) => ({ slug })),
  ];
}

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  // The path each twin is a twin OF, so the file can name its own canonical
  // URL (src/lib/md-header.ts). 'index' is the landing page, i.e. '/'.
  if (params.slug === 'index') return md(withMdHeader(landingMd(), '/'));
  if (params.slug === 'agents') return md(withMdHeader(agentsMd(), '/agents'));
  const tool = toolMd(params.slug);
  if (tool) return md(withMdHeader(tool, `/${params.slug}`));
  return new NextResponse('Not found', { status: 404 });
}
