import { NextResponse } from 'next/server';
import { withMdHeader } from '@/lib/md-header';
import { SITE_URL, API_URL } from '@/lib/urls';

export const runtime = 'nodejs';

/**
 * Twin of /signup. Same reasoning as login.md: it is in the sitemap, so it is a
 * published page, so it needs a twin. The content is the answer to the question
 * an agent is actually holding — "how does my user get a key" — rather than a
 * description of a form it cannot fill in.
 */
export async function GET() {
  const body = `# Create a Resms account

Free sandbox key, instantly, no card. Sign-up is a human step: there is no API
that creates accounts.

1. Open ${SITE_URL}/signup and sign up (email or Google).
2. Copy the test key (\`resms_sk_test_...\`) from the console.
3. Every endpoint works in test mode against ${API_URL}/v1, including magic
   numbers for verification. See ${SITE_URL}/docs/sandbox.md.

- Free tier and rates: ${SITE_URL}/pricing.md
- Credential handling for agents: ${SITE_URL}/auth.md
- Quickstart: ${SITE_URL}/docs/quickstart.md
`;

  return new NextResponse(withMdHeader(body, '/signup'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
