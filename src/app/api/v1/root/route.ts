import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * What `api.opensms.dev/` returns.
 *
 * Without this the API hostname serves the marketing homepage, which is a bad
 * first impression for the one person most likely to hit it: a developer
 * poking the base URL to check the thing is alive. Point them at the docs and
 * tell them the API is up.
 */
export async function GET() {
  return NextResponse.json(
    {
      name: 'OpenSMS',
      description: 'SMS, phone verification, numbers and spam lookup.',
      version: 'v1',
      status: 'ok',
      documentation: 'https://opensms.dev/docs',
      openapi: 'https://opensms.dev/api/v1/openapi.json',
      console: 'https://opensms.dev/console',
      base_url: 'https://api.opensms.dev/v1',
      // Answering "why did my call 401?" before they have to ask.
      authentication: 'Bearer token — send `Authorization: Bearer ghost_sk_test_...`',
    },
    {
      headers: {
        // Static content; let the edge hold it rather than waking a lambda.
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    }
  );
}
