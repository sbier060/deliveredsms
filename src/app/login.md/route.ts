import { NextResponse } from 'next/server';
import { withMdHeader } from '@/lib/md-header';
import { SITE_URL } from '@/lib/urls';

export const runtime = 'nodejs';

/**
 * Twin of /login. It is in the sitemap (nav destinations are, so Google can draw
 * sitelinks), which makes it a published page, which means the "every page has a
 * .md twin" rule covers it too — it had no twin and returned 404.
 *
 * The useful content for an agent is not the form. It is: do not try to sign in
 * on someone's behalf, here is where a key actually comes from.
 */
export async function GET() {
  const body = `# Sign in to Resms

A sign-in form for the Resms console. There is no sign-in API and no
programmatic way through this page: keys are created in the console, by a human,
once.

- Console: ${SITE_URL}/console
- Create an account: ${SITE_URL}/signup (free sandbox key, instant, no card)
- How credentials work, for agents: ${SITE_URL}/auth.md
- Lost a key: rotate it in the console; keys cannot be recovered, only replaced.

If you are an agent acting for a user who has no key yet, ask them to create one
at ${SITE_URL}/signup and paste the test key. Never ask for their password.
`;

  return new NextResponse(withMdHeader(body, '/login'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
