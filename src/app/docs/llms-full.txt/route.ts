import { NextResponse } from 'next/server';
import { fullDocsMarkdown } from '@/lib/dev-docs/content';

export const runtime = 'nodejs';

export async function GET() {
  return new NextResponse(fullDocsMarkdown(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
