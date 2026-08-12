import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isAdminRequest, adminUnauthorized } from '@/lib/admin-auth';
import { getTenant } from '@/lib/api/tenants';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Mark a tenant as internal: unlimited, never metered, never billed — and it
 * stays that way after billing is switched on, because entitlementsFor()
 * short-circuits on the flag before it ever looks at billing state.
 *
 * For OpenSMS's own accounts, so we can use the product as a customer without
 * invoicing ourselves.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminRequest(req)) return adminUnauthorized();
  const tenant = await getTenant(params.id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { internal?: boolean };
  const internal = body.internal !== false;

  await db.ref(`apiTenants/${params.id}`).update({
    internal,
    status: internal ? 'live' : tenant.status,
  });
  return NextResponse.json({ ok: true, id: params.id, internal });
}
