import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { removeMember } from '@/lib/api/team';

export const runtime = 'nodejs';
export const maxDuration = 15;

/** Remove a member (admin only). The owner cannot be removed. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { uid: string } }
) {
  const ctx = await requireTenantContext(req, 'admin');
  if (typeof ctx === 'string') {
    return NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });
  }

  const removed = await removeMember(ctx.tenant, params.uid);
  if (!removed) {
    return NextResponse.json({ error: 'Member not found (the owner cannot be removed).' }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
