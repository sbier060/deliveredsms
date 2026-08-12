import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isAdminRequest, adminUnauthorized } from '@/lib/admin-auth';
import { getTenant, DEFAULT_LIVE_QUOTAS } from '@/lib/api/tenants';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminRequest(req)) return adminUnauthorized();
  const tenant = await getTenant(params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    quotas?: Partial<typeof DEFAULT_LIVE_QUOTAS>;
  };
  await db.ref(`apiTenants/${params.id}`).update({
    status: 'live',
    quotas: { ...DEFAULT_LIVE_QUOTAS, ...(body.quotas || {}) },
    liveApprovedAt: Date.now(),
    liveApprovedBy: 'admin',
  });
  return NextResponse.json({ ok: true, id: params.id, status: 'live' });
}
