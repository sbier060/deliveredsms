import { FREE_TIER, PAYG_CEILINGS } from './pricing';
import type { ApiTenant } from './types';

/**
 * What a tenant is allowed to do right now, derived from its billing state.
 * Pure — no I/O, so it can be unit-tested and called on every request.
 */
export interface Entitlements {
  plan: 'free' | 'payg';
  messagesPerDay: number;
  /** null = uncapped. */
  messagesPerMonth: number | null;
  lookupsPerDay: number;
  lookupsPerMonth: number | null;
  verificationsPerDay: number;
  verificationsPerMonth: number | null;
  numbersMax: number;
  verifiedRecipientsOnly: boolean;
  /** Whether usage should be reported to Stripe. */
  meterEvents: boolean;
}

export function entitlementsFor(tenant: ApiTenant): Entitlements {
  // Internal Ghost accounts: full access, never metered. Checked FIRST so no
  // later billing change can start charging us for using our own product.
  if (tenant.internal) {
    return {
      plan: 'payg',
      messagesPerDay: 100_000,
      messagesPerMonth: null,
      lookupsPerDay: 100_000,
      lookupsPerMonth: null,
      verificationsPerDay: 100_000,
      verificationsPerMonth: null,
      numbersMax: 1_000,
      verifiedRecipientsOnly: false,
      meterEvents: false,
    };
  }

  const billing = tenant.billing;
  const paid = billing?.plan === 'payg' && billing.status === 'active';
  const pastDue = billing?.plan === 'payg' && billing.status === 'past_due';

  const base: Entitlements = paid
    ? {
        plan: 'payg',
        messagesPerDay: PAYG_CEILINGS.messagesPerDay,
        messagesPerMonth: null,
        lookupsPerDay: PAYG_CEILINGS.lookupsPerDay,
        lookupsPerMonth: null,
        verificationsPerDay: PAYG_CEILINGS.verificationsPerDay,
        verificationsPerMonth: null,
        numbersMax: PAYG_CEILINGS.numbersMax,
        verifiedRecipientsOnly: false,
        meterEvents: true,
      }
    : {
        plan: 'free',
        messagesPerDay: FREE_TIER.outboundSmsPerDay,
        messagesPerMonth: FREE_TIER.outboundSmsPerMonth,
        lookupsPerDay: FREE_TIER.lookupsPerDay,
        lookupsPerMonth: FREE_TIER.lookupsPerMonth,
        verificationsPerDay: FREE_TIER.verificationsPerMonth,
        verificationsPerMonth: FREE_TIER.verificationsPerMonth,
        numbersMax: FREE_TIER.numbersMax,
        verifiedRecipientsOnly: true,
        // Past-due accounts still owe us for what they send.
        meterEvents: pastDue,
      };

  // Per-tenant overrides are a CEILING RAISE, never a cut: some tenants were
  // hand-tuned by an admin and must not be silently downgraded by plan defaults.
  const q = tenant.quotas;
  return {
    ...base,
    messagesPerDay: Math.max(base.messagesPerDay, q?.messagesPerDay ?? 0),
    lookupsPerDay: Math.max(base.lookupsPerDay, q?.lookupsPerDay ?? 0),
    numbersMax: Math.max(base.numbersMax, q?.numbersMax ?? 0),
  };
}
