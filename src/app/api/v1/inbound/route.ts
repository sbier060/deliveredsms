import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { normalizeE164, digits10 } from '@/lib/api/phone';
import { storeMessage } from '@/lib/api/messages';
import { processInbound } from '@/lib/api/inbound';

export const runtime = 'nodejs';
export const maxDuration = 20;

/**
 * Live carrier ingest for inbound SMS.
 *
 * Not a tenant-facing endpoint — this is infrastructure calling us, so it is
 * authenticated with a shared secret rather than an API key. Sinch routes
 * inbound per account rather than per number, so every inbound for every number
 * lands on the consumer webhook first; that function forwards the ones whose
 * destination is an API-owned number here.
 *
 * `apiNumberWebhooks/{digits} -> tenantId` is written on every purchase in
 * /v1/numbers and, until now, read by nothing. This is what it was for.
 */
function authorized(req: NextRequest): boolean {
  const expected =
    process.env.INBOUND_INGEST_SECRET || process.env.ADMIN_API_SECRET || '';
  if (!expected) return false;
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return got.length > 0 && got === expected;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const { to, from, body, carrierMessageId, media } = (raw || {}) as Record<string, unknown>;
  const mediaUrls = Array.isArray(media)
    ? media.filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 10)
    : [];

  const toE164 = normalizeE164(to);
  const fromE164 = normalizeE164(from);
  if (!toE164 || !fromE164 || typeof body !== 'string') {
    return NextResponse.json({ error: 'to, from and body are required' }, { status: 400 });
  }

  const owner = await db.ref(`apiNumberWebhooks/${digits10(toE164)}`).get();
  if (!owner.exists()) {
    // Not an API-owned number. The consumer pipeline owns it; say so quietly
    // rather than erroring, so a misrouted forward is never retried forever.
    return new NextResponse(null, { status: 204 });
  }
  const tenantId = owner.val() as string;

  const stored = await storeMessage(tenantId, {
    to: toE164,
    from: fromE164,
    body,
    direction: 'inbound',
    status: 'received',
    test: false,
    ...(typeof carrierMessageId === 'string' ? { carrierMessageId } : {}),
    ...(mediaUrls.length ? { media: mediaUrls } : {}),
  });

  const { intent } = await processInbound({
    tenantId,
    to: toE164,
    from: fromE164,
    body,
    test: false,
    messageId: stored.id,
  });

  return NextResponse.json({ received: true, message_id: stored.id, intent });
}
