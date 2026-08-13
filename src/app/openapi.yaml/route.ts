import { NextResponse } from 'next/server';
import { openApiSpec, toYaml } from '@/lib/dev-docs/openapi';

export const runtime = 'nodejs';

/** Root-level alias of /api/v1/openapi.yaml. See ./openapi.json/route.ts. */
export async function GET() {
  return new NextResponse(toYaml(openApiSpec) + '\n', {
    headers: {
      'Content-Type': 'application/yaml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
