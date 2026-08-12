import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest, adminUnauthorized } from '@/lib/admin-auth';
import { getTenant } from '@/lib/api/tenants';
import { mintKey } from '@/lib/api/keys';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminRequest(req)) return adminUnauthorized();
  const tenant = await getTenant(params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { mode?: string; name?: string };
  const mode = body.mode === 'live' ? 'live' : 'test';
  if (mode === 'live' && tenant.status !== 'live') {
    return NextResponse.json({ error: 'Tenant is not live — approve-live first.' }, { status: 400 });
  }
  const minted = await mintKey({ tenantId: params.id, mode, name: body.name });
  return NextResponse.json({ keyId: minted.keyId, key: minted.secret, mode });
}
