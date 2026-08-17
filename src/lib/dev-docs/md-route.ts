import { NextResponse } from 'next/server';
import { withMdHeader } from '@/lib/md-header';
import { getDocsPage } from './content';

/** Shared handler for the .md twins of docs pages (agent-optimized surface). */
export function makeMdRoute(slug: string) {
  return async function GET() {
    const page = getDocsPage(slug);
    if (!page) return new NextResponse('Not found', { status: 404 });
    // Every twin states its own canonical URL. See src/lib/md-header.ts: a twin
    // travels detached from the site, so the file has to say which page it is.
    return new NextResponse(withMdHeader(page.markdown, `/docs/${slug}`), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    });
  };
}
