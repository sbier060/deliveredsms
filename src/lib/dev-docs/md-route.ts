import { NextResponse } from 'next/server';
import { getDocsPage } from './content';

/** Shared handler for the .md twins of docs pages (agent-optimized surface). */
export function makeMdRoute(slug: string) {
  return async function GET() {
    const page = getDocsPage(slug);
    if (!page) return new NextResponse('Not found', { status: 404 });
    return new NextResponse(page.markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    });
  };
}
