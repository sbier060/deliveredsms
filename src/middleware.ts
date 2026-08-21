import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import { resolveGeoConsentRequirement } from './lib/consent';

const SITE_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN || 'resms.com';

// Delivered-era hostnames. SDKs and CLIs published before the Resms rebrand
// have api.deliveredsms.com baked in and will never be upgraded, so the
// machine hosts stay first-class here rather than being redirected: a 308
// preserves method and body, but it still costs every legacy client an extra
// round trip on every call. The apex is a different story - browsers and
// crawlers should be pushed to the new canonical host.
const LEGACY_SITE_DOMAIN = 'deliveredsms.com';

const isApiHost = (host: string) =>
  host === `api.${SITE_DOMAIN}` || host === `api.${LEGACY_SITE_DOMAIN}`;
const isMcpHost = (host: string) =>
  host === `mcp.${SITE_DOMAIN}` || host === `mcp.${LEGACY_SITE_DOMAIN}`;

// AI crawlers/agents identify themselves; analytics never sees them because
// they don't run JS. Counted server-side instead ("check your server logs").
const AGENT_UA =
  /GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-Web|anthropic-ai|PerplexityBot|Google-Extended|Applebot-Extended|cohere-ai|Bytespider|CCBot|meta-externalagent|Amazonbot|YouBot|DuckAssistBot|MistralAI/i;

// Pages (not docs) that have markdown twins served from /md/[slug].
const MD_TWIN: Record<string, string> = {
  '/': '/md/index',
  '/agents': '/md/agents',
  '/claude': '/md/claude',
  '/claude-code': '/md/claude-code',
  '/cursor': '/md/cursor',
  '/codex': '/md/codex',
  '/devin': '/md/devin',
  '/copilot': '/md/copilot',
};

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';

  // Server-side agent-traffic beacon (fire-and-forget; never blocks a page).
  const ua = request.headers.get('user-agent') || '';
  const botMatch = ua.match(AGENT_UA);
  if (botMatch && request.method === 'GET' && !pathname.startsWith('/api/')) {
    event.waitUntil(
      fetch(`${request.nextUrl.origin}/api/agent-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot: botMatch[0], path: pathname }),
      }).catch(() => {})
    );
  }

  // The skills shipped as /skills/delivered* before the Resms rebrand. Agents
  // that installed them have the old URL baked into their config and the
  // .well-known index was crawled at that path, so these have to keep
  // resolving rather than 404.
  const RENAMED_SKILL = /^\/skills\/delivered(-verify)?(\/.*)?$/;
  const skillMatch = pathname.match(RENAMED_SKILL);
  if (skillMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/skills/resms${skillMatch[1] || ''}${skillMatch[2] || ''}`;
    return NextResponse.redirect(url, 308);
  }

  // Canonical host is the apex. www served an identical 200 for every path,
  // which is site-wide duplicate content - the canonical tags pointed at the
  // apex and mitigated it, but a 308 is what actually settles it.
  if (
    host === `www.${SITE_DOMAIN}` ||
    host === LEGACY_SITE_DOMAIN ||
    host === `www.${LEGACY_SITE_DOMAIN}`
  ) {
    const url = request.nextUrl.clone();
    url.host = SITE_DOMAIN;
    return NextResponse.redirect(url, 308);
  }

  // The API hosts answer JSON, not pages. Without this they are crawlable and
  // will get indexed as thin duplicates of the docs.
  if (isApiHost(host) || isMcpHost(host)) {
    if (pathname === '/robots.txt') {
      return new NextResponse('User-agent: *\nDisallow: /\n', {
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  }

  // api.<domain>/ serves the API index. This lives in middleware rather than
  // vercel.json because vercel.json rewrites are applied AFTER the filesystem
  // check, so "/" would always match the landing page first. Middleware runs
  // before the filesystem. (next.config.js rewrites don't work either: a
  // `rewrites` block in vercel.json overrides them entirely, and the /v1/*
  // host rule lives there.)
  if (isApiHost(host) && pathname === '/') {
    return NextResponse.rewrite(new URL('/api/v1/root', request.url));
  }

  // mcp.<domain> IS the MCP server - every path maps to the endpoint, so
  // whatever base URL an MCP client is configured with just works.
  if (isMcpHost(host)) {
    return NextResponse.rewrite(new URL('/api/mcp', request.url));
  }

  // Content negotiation for agents: Accept: text/markdown on ANY content
  // page serves its markdown twin - docs/pricing have .md sibling routes,
  // everything else maps through /md/[slug].
  if (
    request.method === 'GET' &&
    (request.headers.get('accept') || '').includes('text/markdown')
  ) {
    if (/^\/docs\/[a-z0-9-]+$/.test(pathname) || pathname === '/pricing') {
      return NextResponse.rewrite(new URL(`${pathname}.md`, request.url));
    }
    if (MD_TWIN[pathname]) {
      return NextResponse.rewrite(new URL(MD_TWIN[pathname], request.url));
    }
  }

  // Direct .md URLs for the non-docs pages (/claude-code.md, /agents.md, /index.md).
  if (request.method === 'GET' && pathname.endsWith('.md')) {
    const base = pathname.slice(0, -3) || '/';
    if (MD_TWIN[base === '/index' ? '/' : base]) {
      return NextResponse.rewrite(
        new URL(MD_TWIN[base === '/index' ? '/' : base], request.url)
      );
    }
  }

  // Geo-consent cookie for the analytics gate (EU/EEA + US consent states).
  if (!request.cookies.has('resms_geo_requires_consent') && !pathname.startsWith('/api')) {
    const country = request.geo?.country || request.headers.get('x-vercel-ip-country') || '';
    const region = request.geo?.region || request.headers.get('x-vercel-ip-country-region') || '';
    const { requiresConsent } = resolveGeoConsentRequirement(country, region);
    const response = NextResponse.next();
    response.cookies.set('resms_geo_requires_consent', requiresConsent ? '1' : '0', {
      maxAge: 60 * 60 * 24 * 90,
      path: '/',
      sameSite: 'lax',
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
