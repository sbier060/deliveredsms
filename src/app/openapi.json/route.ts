import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/dev-docs/openapi';

export const runtime = 'nodejs';

/**
 * Root-level alias of /api/v1/openapi.json - the path agents, SDK generators,
 * and Postman look for first (the Resend/Stripe convention). Same spec object,
 * so the two can never drift.
 */
export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' },
  });
}
