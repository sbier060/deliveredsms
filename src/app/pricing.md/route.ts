import { NextResponse } from 'next/server';
import { withMdHeader } from '@/lib/md-header';
import {
  pricingTableMarkdown,
  freeTierMarkdown,
  COMPETITORS_CHECKED_ON,
} from '@/lib/api/pricing';

export const runtime = 'nodejs';

/**
 * Markdown twin of /pricing - the Resend pattern (pricing.md).
 * Generated from pricing.ts so it can never disagree with what billing
 * actually charges.
 */
export async function GET() {
  const body = `# Delivered Pricing

Usage-based. No platform fee, no commitments, no sales call.
Carrier fees are included in every rate; nothing is added on top.

${pricingTableMarkdown()}

Phone verification is charged only when a code is successfully verified.
Blocked, expired, and abandoned attempts are free.

## Free tier

${freeTierMarkdown()}

## Notes

- Competitor comparison last checked: ${COMPETITORS_CHECKED_ON}; details at https://deliveredsms.com/pricing
- 10DLC registration is included in the phone number price.
- Full docs: https://deliveredsms.com/docs/llms-full.txt
`;

  return new NextResponse(withMdHeader(body, '/pricing'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
