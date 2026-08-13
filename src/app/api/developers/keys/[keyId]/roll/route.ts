import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { requireUser } from '@/lib/api/console-auth';
import { getTenantIdByUid } from '@/lib/api/tenants';
import { mintKey, revokeKey } from '@/lib/api/keys';
import type { ApiKeyRecord } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 15;

/** Roll a key: revoke the old one, mint a same-mode replacement, return it once. */
export async function POST(
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

  const hashSnap = await db.ref(`apiKeysByTenant/${tenantId}/${params.keyId}`).get();
  if (!hashSnap.exists()) return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  const old = (await db.ref(`apiKeys/${hashSnap.val()}`).get()).val() as ApiKeyRecord | null;
  if (!old) return NextResponse.json({ error: 'Key not found' }, { status: 404 });

  await revokeKey(tenantId, params.keyId);
  const minted = await mintKey({ tenantId, mode: old.mode, name: old.name });
  return NextResponse.json({
    key: {
      id: minted.keyId,
      name: minted.record.name,
      mode: minted.record.mode,
      prefix: minted.record.prefix,
      createdAt: minted.record.createdAt,
      lastUsedAt: null,
      status: 'active',
      key: minted.secret,
    },
  });
}
