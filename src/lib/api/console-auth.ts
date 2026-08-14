import { NextRequest } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import type { ApiTenant } from './types';
import { getTenantIdByUid, getTenant } from './tenants';
import { roleOf, type TeamRole } from './team';
import { isMfaVerified, mfaAvailable } from './mfa';

/**
 * Console-route auth: verify a Firebase ID token from Authorization: Bearer.
 * No body-uid fallback, ever (the consumer dashboard's localStorage pattern
 * must not leak into the developer surface).
 *
 * Password sign-ins additionally require the email-OTP second factor for the
 * current sign-in (see lib/api/mfa.ts); federated sign-ins (Google) carry
 * their own 2FA and are exempt. The MFA routes themselves pass
 * `enforceMfa: false` - they are how a session becomes verified.
 */
export interface ConsoleUser {
  uid: string;
  email: string;
  name: string;
  /** Sign-in provider from the token: 'password', 'google.com', ... */
  provider: string;
  /** Token auth_time in seconds - the moment of the underlying sign-in. */
  authTime: number;
}

export async function requireUser(
  req: NextRequest,
  opts: { enforceMfa?: boolean } = {}
): Promise<ConsoleUser | null> {
  const { enforceMfa = true } = opts;
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/);
  if (!match) return null;
  try {
    const decoded = await auth.verifyIdToken(match[1]);
    const provider = (decoded.firebase?.sign_in_provider as string) || 'unknown';
    const authTime = decoded.auth_time as number;
    if (
      enforceMfa &&
      provider === 'password' &&
      mfaAvailable() &&
      !(await isMfaVerified(decoded.uid, authTime))
    ) {
      return null;
    }
    return {
      uid: decoded.uid,
      email: decoded.email || '',
      name: (decoded.name as string) || decoded.email?.split('@')[0] || 'Developer',
      provider,
      authTime,
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
