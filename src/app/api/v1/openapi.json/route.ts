import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/dev-docs/openapi';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' },
  });
}
