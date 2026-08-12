import { db } from '@/lib/firebase-admin';
import { digits10 } from './phone';
import { FREE_TIER } from './pricing';
import type { ApiTenant } from './types';

/**
 * Free-tier send targets. Mirrors Resend's "verify a domain before you can
 * send anywhere" gate: it keeps the free tier from becoming a spam relay
 * without putting a credit card in front of the first real text.
 */

export function isVerifiedRecipient(tenant: ApiTenant, e164: string): boolean {
  const record = tenant.verifiedRecipients?.[digits10(e164)];
  return Boolean(record && !!record.verifiedAt);
}

export function verifiedRecipientCount(tenant: ApiTenant): number {
  return Object.keys(tenant.verifiedRecipients || {}).length;
}

export function canAddVerifiedRecipient(tenant: ApiTenant): boolean {
  return verifiedRecipientCount(tenant) < FREE_TIER.maxVerifiedRecipients;
}

export async function addVerifiedRecipient(
  tenantId: string,
  e164: string
): Promise<void> {
  await db.ref(`apiTenants/${tenantId}/verifiedRecipients/${digits10(e164)}`).set({
    phoneNumber: e164,
    verifiedAt: Date.now(),
  });
}

export async function removeVerifiedRecipient(
  tenantId: string,
  e164: string
): Promise<void> {
  await db
    .ref(`apiTenants/${tenantId}/verifiedRecipients/${digits10(e164)}`)
    .remove();
}
