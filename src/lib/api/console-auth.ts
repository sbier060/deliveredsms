import { NextRequest } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import type { ApiTenant } from './types';

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
