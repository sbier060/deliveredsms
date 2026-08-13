import { db } from '@/lib/firebase-admin';
import { apiBillingStripe } from './stripe';
import type { ApiTenant } from '../types';

/**
 * The API tenant's Stripe customer.
 *
 * HARD RULE - this customer must be unreachable from the consumer webhook.
 * src/app/api/webhook/route.ts resolves a Firebase user two ways only:
 *   1. customer.metadata.firebaseUid
 *   2. users/{uid}/stripeCustomerId  (indexed lookup)
 * So this customer NEVER carries firebaseUid metadata, and we NEVER write the
 * id onto the consumer user record. A developer who is also a Ghost customer
 * deliberately ends up with two Stripe customers; that is the price of not
 * being able to nuke their phone plan from the API billing path.
 */

const FORBIDDEN_METADATA_KEYS = ['firebaseUid', 'userId', 'uid'];

export async function getOrCreateApiCustomer(tenant: ApiTenant): Promise<string> {
  const existing = tenant.billing?.stripeCustomerId;
  if (existing) return existing;

  const metadata: Record<string, string> = {
    ghost_api_tenant_id: tenant.id,
    ghost_surface: 'developer_api',
  };
  // Belt and braces: assert at runtime that no consumer marker slipped in.
  for (const key of FORBIDDEN_METADATA_KEYS) {
    if (key in metadata) {
      throw new Error(
        `[api-billing] Refusing to create a Stripe customer carrying "${key}"; it would make this customer resolvable by the consumer webhook.`
      );
    }
  }

  const stripe = apiBillingStripe();
  const customer = await stripe.customers.create({
    email: tenant.email,
    name: `Delivered · ${tenant.name || tenant.id}`,
    description: `Ghost developer API tenant ${tenant.id}`,
    metadata,
  });

  await db.ref(`apiTenants/${tenant.id}/billing`).update({
    stripeCustomerId: customer.id,
    plan: tenant.billing?.plan || 'free',
    status: tenant.billing?.status || 'none',
    updatedAt: Date.now(),
  });

  return customer.id;
}

/** Resolve a tenant id from any Stripe object that carries our metadata. */
export function tenantIdFromMetadata(
  metadata: Record<string, string> | null | undefined
): string | null {
  const id = metadata?.ghost_api_tenant_id;
  return typeof id === 'string' && id.startsWith('tn_') ? id : null;
}
