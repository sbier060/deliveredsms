import { NextResponse } from 'next/server';
import { withMdHeader } from '@/lib/md-header';
import { getDocsPage } from '@/lib/dev-docs/content';

export const runtime = 'nodejs';

/**
 * Root-level alias of /docs/changelog.md - the path agents look for first
 * (Resend serves its changelog index from the root). Same page object.
 */
export async function GET() {
  const page = getDocsPage('changelog');
  if (!page) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(withMdHeader(page.markdown, '/docs/changelog'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
