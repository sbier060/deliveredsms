import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/console-auth';
import { getTenantIdByUid, getTenant } from '@/lib/api/tenants';
import { listKeys, mintKey } from '@/lib/api/keys';
import type { ApiKeyRecord } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

function sanitize(k: ApiKeyRecord) {
  return {
    id: k.keyId,
    name: k.name,
    mode: k.mode,
    prefix: k.prefix,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt ?? null,
    status: k.revokedAt ? 'revoked' : 'active',
  };
}

export async function GET(req: NextRequest) {
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
  const keys = await listKeys(tenantId);
  return NextResponse.json({ keys: keys.map(sanitize) });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantIdByUid(user.uid);
  const tenant = tenantId ? await getTenant(tenantId) : null;
  if (!tenantId || !tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });
  // Admin surface: members must not reach this route.
  {
    const { roleOf } = await import('@/lib/api/team');
    if ((await roleOf(tenant, user.uid)) !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
  }

  const body = (await req.json().catch(() => ({}))) as { mode?: string; name?: string };
  const mode = body.mode === 'live' ? 'live' : 'test';
  if (mode === 'live' && tenant.status !== 'live') {
    return NextResponse.json(
      { error: 'Live keys require live access. Request it from the console overview.' },
      { status: 403 }
    );
  }

  const minted = await mintKey({
    tenantId,
    mode,
    name: typeof body.name === 'string' ? body.name.slice(0, 60) : undefined,
  });
  return NextResponse.json({
    key: { ...sanitize(minted.record), key: minted.secret },
  });
}
