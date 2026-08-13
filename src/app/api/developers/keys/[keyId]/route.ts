import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/console-auth';
import { getTenantIdByUid } from '@/lib/api/tenants';
import { revokeKey } from '@/lib/api/keys';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function DELETE(
  req: NextRequest,
  { params }: { params: { keyId: string } }
) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantIdByUid(user.uid);
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 404 });
  // Admin surface: members must not reach keys/billing/webhooks. The role
  // check rides on the same resolution the route already does.
  {
    const { roleOf } = await import('@/lib/api/team');
    const { getTenant: _gt } = await import('@/lib/api/tenants');
    const _t = await _gt(tenantId);
    if (!_t || (await roleOf(_t, user.uid)) !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
  }

  const ok = await revokeKey(tenantId, params.keyId);
  if (!ok) return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
