import { NextResponse } from 'next/server';
import { PRIVACY_MD } from '@/lib/legal';

export const runtime = 'nodejs';

/** Markdown twin of /privacy. See ./terms.md/route.ts. */
export async function GET() {
  return new NextResponse(PRIVACY_MD, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
