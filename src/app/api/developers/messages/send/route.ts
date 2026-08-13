import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { normalizeE164, digits10 } from '@/lib/api/phone';
import { sendOutbound } from '@/lib/api/send-core';
import { getContactByPhone } from '@/lib/api/contacts';
import { renderMerge } from '@/lib/api/merge';
import { getMember } from '@/lib/api/team';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Console compose. Same pipeline as POST /v1/messages (send-core), plus the
 * console-only conveniences: merge fields resolved against the contact, the
 * member's signature appended, and the sender's name stamped for attribution.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') {
    return NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });
  }

  const raw = (await req.json().catch(() => ({}))) as { to?: unknown; from?: unknown; body?: unknown };
  const toE164 = normalizeE164(raw.to);
  const fromE164 = normalizeE164(raw.from);
  if (!toE164) return NextResponse.json({ error: '`to` must be a valid US/Canada number.' }, { status: 400 });
  if (!fromE164) return NextResponse.json({ error: '`from` must be a valid US/Canada number.' }, { status: 400 });
  if (typeof raw.body !== 'string' || !raw.body.trim()) {
    return NextResponse.json({ error: '`body` is required.' }, { status: 400 });
  }

  const number = ctx.tenant.numbers?.[digits10(fromE164)];
  if (!number || number.releasedAt) {
    return NextResponse.json({ error: '`from` must be one of your numbers.' }, { status: 403 });
  }

  // Merge + signature. The member record holds the signature; the owner has
  // no member record, so their compose sends unsigned unless they add one.
  const contact = await getContactByPhone(ctx.tenantId, toE164);
  let body = renderMerge(raw.body, contact).trim();
  const member = await getMember(ctx.tenantId, ctx.user.uid);
  if (member?.signature) body = `${body}\n${member.signature}`;
  if (body.length > 1600) {
    return NextResponse.json({ error: 'Message exceeds 1600 characters after merge/signature.' }, { status: 400 });
  }

  const result = await sendOutbound(ctx.tenantId, ctx.tenant, number.mode, {
    to: toE164,
    from: fromE164,
    body,
    sentBy: { uid: ctx.user.uid, name: ctx.user.name },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }
  return NextResponse.json({ message: result.message }, { status: 201 });
}
