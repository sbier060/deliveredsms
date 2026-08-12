import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isAdminRequest, adminUnauthorized } from '@/lib/admin-auth';
import { getTenant } from '@/lib/api/tenants';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminRequest(req)) return adminUnauthorized();
  const tenant = await getTenant(params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  await db.ref(`apiTenants/${params.id}/status`).set('suspended');
  return NextResponse.json({ ok: true, id: params.id, status: 'suspended' });
}
