import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/console-auth';
import { acceptInvite, getInvite } from '@/lib/api/team';
import { getTenant } from '@/lib/api/tenants';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Accept an invite. Unlike every other console route this must NOT resolve a
 * tenant first - the whole point is that the caller doesn't have one yet.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { token?: string };
  if (!body.token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const result = await acceptInvite(body.token, user);
  if (!result.ok) {
    const messages: Record<string, string> = {
      invalid: 'This invite link is not valid.',
      expired: 'This invite link has expired. Ask for a new one.',
      used: 'This invite link was already used.',
      already_elsewhere:
        'This account already belongs to a different Resms team. Use another Google account or email.',
      team_full: 'This team is full.',
    };
    return NextResponse.json({ error: messages[result.reason] }, { status: 409 });
  }

  return NextResponse.json({ joined: true, tenantId: result.tenantId, role: result.role });
}

/** Peek at an invite (used by the /join page before sign-in). */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const invite = await getInvite(token);
  if (!invite || invite.usedBy || Date.now() > invite.expiresAt) {
    return NextResponse.json({ valid: false });
  }
  const tenant = await getTenant(invite.tenantId);
  return NextResponse.json({
    valid: true,
    teamName: tenant?.name || 'a Resms team',
    role: invite.role,
  });
}
