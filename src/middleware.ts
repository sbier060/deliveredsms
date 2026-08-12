import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveGeoConsentRequirement } from './lib/consent';

const SITE_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN || 'deliveredsms.com';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';

  // api.<domain>/ serves the API index. This lives in middleware rather than
  // vercel.json because vercel.json rewrites are applied AFTER the filesystem
  // check, so "/" would always match the landing page first. Middleware runs
  // before the filesystem. (next.config.js rewrites don't work either: a
  // `rewrites` block in vercel.json overrides them entirely, and the /v1/*
  // host rule lives there.)
  if (host === `api.${SITE_DOMAIN}` && pathname === '/') {
    return NextResponse.rewrite(new URL('/api/v1/root', request.url));
  }

  // mcp.<domain> IS the MCP server — every path maps to the endpoint, so
  // whatever base URL an MCP client is configured with just works.
  if (host === `mcp.${SITE_DOMAIN}`) {
    return NextResponse.rewrite(new URL('/api/mcp', request.url));
  }

  // Content negotiation for agents: Accept: text/markdown on a docs or
  // pricing page serves the markdown twin without knowing the .md convention.
  if (
    request.method === 'GET' &&
    (request.headers.get('accept') || '').includes('text/markdown') &&
    (/^\/docs\/[a-z0-9-]+$/.test(pathname) || pathname === '/pricing')
  ) {
    return NextResponse.rewrite(new URL(`${pathname}.md`, request.url));
  }

  // Geo-consent cookie for the analytics gate (EU/EEA + US consent states).
  if (!request.cookies.has('dsms_geo_requires_consent') && !pathname.startsWith('/api')) {
    const country = request.geo?.country || request.headers.get('x-vercel-ip-country') || '';
    const region = request.geo?.region || request.headers.get('x-vercel-ip-country-region') || '';
    const { requiresConsent } = resolveGeoConsentRequirement(country, region);
    const response = NextResponse.next();
    response.cookies.set('dsms_geo_requires_consent', requiresConsent ? '1' : '0', {
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
