import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { createInvite } from '@/lib/api/team';
import { takeSlot } from '@/lib/api/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 15;

/** Mint a single-use invite link (admin only). */
export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext(req, 'admin');
  if (typeof ctx === 'string') {
    return NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });
  }

  // An invite link is an unauthenticated credential until used; cap minting.
  const slot = await takeSlot(`team_invite_${ctx.tenantId}`, 10, 60 * 60_000);
  if (!slot.allowed) {
    return NextResponse.json({ error: 'Too many invites created recently.' }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { role?: string };
  const role = body.role === 'admin' ? 'admin' : 'member';

  const { token, invite } = await createInvite(ctx.tenantId, role, ctx.user.uid);
  return NextResponse.json({
    token,
    url: `https://deliveredsms.com/join/${token}`,
    role: invite.role,
    expiresAt: invite.expiresAt,
  });
}
