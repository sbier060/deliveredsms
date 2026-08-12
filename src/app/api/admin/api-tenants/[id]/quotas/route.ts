import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isAdminRequest, adminUnauthorized } from '@/lib/admin-auth';
import { getTenant } from '@/lib/api/tenants';
import type { TenantQuotas } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminRequest(req)) return adminUnauthorized();
  const tenant = await getTenant(params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Partial<TenantQuotas>;
  const quotas: TenantQuotas = { ...tenant.quotas };
  for (const field of ['messagesPerDay', 'numbersMax', 'lookupsPerDay'] as const) {
    const v = body[field];
    if (typeof v === 'number' && v >= 0 && Number.isFinite(v)) quotas[field] = Math.floor(v);
  }
  await db.ref(`apiTenants/${params.id}/quotas`).set(quotas);
  return NextResponse.json({ ok: true, id: params.id, quotas });
}
