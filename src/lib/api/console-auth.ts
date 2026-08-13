import { NextRequest } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import type { ApiTenant } from './types';
import { getTenantIdByUid, getTenant } from './tenants';
import { roleOf, type TeamRole } from './team';

/**
 * Console-route auth: verify a Firebase ID token from Authorization: Bearer.
 * No body-uid fallback, ever (the consumer dashboard's localStorage pattern
 * must not leak into the developer surface).
 */
export interface ConsoleUser {
  uid: string;
  email: string;
  name: string;
}

export async function requireUser(req: NextRequest): Promise<ConsoleUser | null> {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/);
  if (!match) return null;
  try {
    const decoded = await auth.verifyIdToken(match[1]);
    return {
      uid: decoded.uid,
      email: decoded.email || '',
      name: (decoded.name as string) || decoded.email?.split('@')[0] || 'Developer',
    };
  } catch {
    return null;
  }
}

export interface TenantContext {
  user: ConsoleUser;
  tenantId: string;
  tenant: ApiTenant;
  role: TeamRole;
}

/**
 * The full resolution most console routes need: verified user → tenant →
 * role within it. Returns a discriminated error string instead of throwing so
 * routes can map straight to a status code. `minRole: 'admin'` gates the
 * routes members must not reach (keys, billing, webhooks, team, numbers).
 */
export async function requireTenantContext(
  req: NextRequest,
  minRole: TeamRole = 'member'
): Promise<TenantContext | 'unauthorized' | 'no_tenant' | 'forbidden'> {
  const user = await requireUser(req);
  if (!user) return 'unauthorized';
  const tenantId = await getTenantIdByUid(user.uid);
  if (!tenantId) return 'no_tenant';
  const tenant = await getTenant(tenantId);
  if (!tenant) return 'no_tenant';
  const role = await roleOf(tenant, user.uid);
  if (!role) return 'no_tenant';
  if (minRole === 'admin' && role !== 'admin') return 'forbidden';
  return { user, tenantId, tenant, role };
}

/** Tenant shape exposed to the console (no internals). */
export function publicTenant(tenant: ApiTenant) {
  const liveAccess = tenant.status === 'live'
    ? 'granted'
    : tenant.liveAccessRequestedAt
      ? 'requested'
      : 'none';
  return {
    id: tenant.id,
    name: tenant.name,
    email: tenant.email,
    status: tenant.status,
    quotas: tenant.quotas,
    liveAccess,
    firstCallAt: tenant.firstCallAt ?? null,
    createdAt: tenant.createdAt,
    numbers: Object.values(tenant.numbers || {})
      .filter((n) => !n.releasedAt)
      .map((n) => ({ phone_number: n.phoneNumber, mode: n.mode })),
  };
}
