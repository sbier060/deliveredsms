import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/lib/firebase-admin';
import { isAdminRequest, adminUnauthorized } from '@/lib/admin-auth';
import { getOrCreateTenant } from '@/lib/api/tenants';
import type { ApiTenant } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return adminUnauthorized();
  const snap = await db.ref('apiTenants').get();
  const tenants = snap.exists() ? (Object.values(snap.val()) as ApiTenant[]) : [];
  return NextResponse.json({
    tenants: tenants
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((t) => ({
        id: t.id,
        email: t.email,
        name: t.name,
        status: t.status,
        quotas: t.quotas,
        createdAt: t.createdAt,
        firstCallAt: t.firstCallAt ?? null,
        liveAccessRequestedAt: t.liveAccessRequestedAt ?? null,
        liveAccessUseCase: t.liveAccessUseCase ?? null,
      })),
  });
}

/** Admin-create a tenant for an email (existing Auth user or a new one). */
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return adminUnauthorized();
  const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string };
  if (!body.email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  let uid: string;
  try {
    uid = (await auth.getUserByEmail(body.email)).uid;
  } catch {
    uid = (await auth.createUser({ email: body.email })).uid;
  }

  const result = await getOrCreateTenant(uid, body.email, body.name || body.email.split('@')[0]);
  return NextResponse.json({
    tenant: { id: result.tenant.id, status: result.tenant.status },
    isNew: result.isNew,
    ...(result.initialKey ? { initialKey: result.initialKey.secret } : {}),
  });
}
