import { db } from '@/lib/firebase-admin';
import { newTenantId } from './ids';
import { mintKey, type MintedKey } from './keys';
import { mintTestNumber } from './sandbox';
import { digits10 } from './phone';
import type { ApiTenant, TenantQuotas } from './types';

/**
 * API tenants. The tenant uid is the developer's own Firebase Auth uid (they
 * sign into the console with Google/email), so existing machinery keyed on uid
 * (phoneNumberOwners, checkBanned, ownership checks) works unchanged.
 */

export const DEFAULT_SANDBOX_QUOTAS: TenantQuotas = {
  messagesPerDay: 1000, // abuse ceiling; sandbox is otherwise unmetered
  numbersMax: 3,
  lookupsPerDay: 100,
};

export const DEFAULT_LIVE_QUOTAS: TenantQuotas = {
  messagesPerDay: 100,
  numbersMax: 2,
  lookupsPerDay: 250,
};

export async function getTenant(tenantId: string): Promise<ApiTenant | null> {
  const snap = await db.ref(`apiTenants/${tenantId}`).get();
  return snap.exists() ? (snap.val() as ApiTenant) : null;
}

export async function getTenantIdByUid(uid: string): Promise<string | null> {
  const snap = await db.ref(`apiTenantsByUid/${uid}`).get();
  return snap.exists() ? (snap.val() as string) : null;
}

export interface ProvisionResult {
  tenant: ApiTenant;
  isNew: boolean;
  initialKey?: MintedKey;
  sandboxNumber?: string;
}

/**
 * Idempotent self-serve provisioning: first call creates a sandbox tenant, a
 * sandbox from-number, and the first test key (returned ONCE); later calls
 * return the existing tenant with no key.
 */
export async function getOrCreateTenant(
  uid: string,
  email: string,
  name: string
): Promise<ProvisionResult> {
  const existingId = await getTenantIdByUid(uid);
  if (existingId) {
    const tenant = await getTenant(existingId);
    if (tenant) return { tenant, isNew: false };
  }

  const id = newTenantId();
  const sandboxNumber = mintTestNumber();
  const tenant: ApiTenant = {
    id,
    uid,
    email,
    name,
    status: 'sandbox',
    quotas: DEFAULT_SANDBOX_QUOTAS,
    createdAt: Date.now(),
    firstCallAt: null,
    numbers: {
      [digits10(sandboxNumber)]: {
        phoneNumber: sandboxNumber,
        purchasedAt: Date.now(),
        mode: 'test',
      },
    },
  };

  // Claim the uid slot first so concurrent first-loads can't double-provision.
  const claim = await db
    .ref(`apiTenantsByUid/${uid}`)
    .transaction((current) => (current === null ? id : undefined));
  if (!claim.committed) {
    const winnerId = claim.snapshot?.val() as string | null;
    const winner = winnerId ? await getTenant(winnerId) : null;
    if (winner) return { tenant: winner, isNew: false };
    throw new Error('tenant_provision_race');
  }

  await db.ref(`apiTenants/${id}`).set(tenant);
  // First-class account-type marker: lets login routing send API developers to
  // the console instead of the consumer dashboard. Additive field on the
  // consumer users node — nothing else in the app reads it.
  await db.ref(`users/${uid}/apiDeveloper`).set(true).catch(() => {});
  const initialKey = await mintKey({ tenantId: id, mode: 'test' });
  return { tenant, isNew: true, initialKey, sandboxNumber };
}

/** Set firstCallAt once, on the tenant's first authenticated API request. */
export function markFirstCall(tenantId: string): void {
  db.ref(`apiTenants/${tenantId}/firstCallAt`)
    .transaction((current) => (current === null || current === undefined ? Date.now() : undefined))
    .catch(() => {});
}

/** The tenant's active (non-released) numbers, E.164. */
export function activeNumbers(tenant: ApiTenant): string[] {
  return Object.values(tenant.numbers || {})
    .filter((n) => !n.releasedAt)
    .map((n) => n.phoneNumber);
}
