import { NextResponse } from 'next/server';
import { TERMS_MD } from '@/lib/legal';

export const runtime = 'nodejs';

/** Markdown twin of /terms. Same TERMS_MD the page renders, so they can't disagree. */
export async function GET() {
  return new NextResponse(TERMS_MD, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
