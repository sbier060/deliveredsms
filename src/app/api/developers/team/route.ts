import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { listMembers } from '@/lib/api/team';

export const runtime = 'nodejs';
export const maxDuration = 15;

/** Members list. Visible to every member; mutations live on sub-routes. */
export async function GET(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') {
    return NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });
  }

  const members = await listMembers(ctx.tenantId);
  return NextResponse.json({
    owner: {
      uid: ctx.tenant.uid,
      email: ctx.tenant.email,
      name: ctx.tenant.name,
      role: 'admin',
      isOwner: true,
    },
    // The owner may have a lazily-created member record (signature storage);
    // don't list them twice.
    members: Object.entries(members).filter(([uid]) => uid !== ctx.tenant.uid).map(([uid, m]) => ({
      uid,
      email: m.email,
      name: m.name,
      role: m.role,
      addedAt: m.addedAt,
    })),
    you: { uid: ctx.user.uid, role: ctx.role },
  });
}
