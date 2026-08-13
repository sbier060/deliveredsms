// Shared types for the public Delivered (/api/v1) platform.

export type TenantStatus = 'sandbox' | 'live' | 'suspended';
export type KeyMode = 'test' | 'live';

export interface TenantQuotas {
  messagesPerDay: number;
  numbersMax: number;
  lookupsPerDay: number;
}

export interface TenantNumber {
  phoneNumber: string; // E.164
  purchasedAt: number;
  mode: KeyMode;
  releasedAt?: number;
}

export type BillingPlan = 'free' | 'payg';
export type BillingStatus = 'none' | 'active' | 'past_due' | 'canceled';

export interface TenantBilling {
  plan: BillingPlan;
  status: BillingStatus;
  /** API-only Stripe customer. NEVER carries firebaseUid - see plan §safety. */
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  items?: Partial<Record<string, string>>;
  paymentMethodAttachedAt?: number;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  delinquentSince?: number;
  updatedAt?: number;
}

export interface VerifiedRecipient {
  phoneNumber: string;
  verifiedAt: number;
}

export interface ApiTenant {
  id: string;
  uid: string;
  email: string;
  name: string;
  status: TenantStatus;
  quotas: TenantQuotas;
  createdAt: number;
  firstCallAt?: number | null;
  liveAccessRequestedAt?: number;
  liveAccessUseCase?: string;
  liveApprovedAt?: number;
  liveApprovedBy?: string;
  numbers?: Record<string, TenantNumber>; // keyed by 10-digit
  /** Absent ⇒ free plan. */
  billing?: TenantBilling;
  /**
   * Internal Ghost account: never metered, never billed, no free-tier
   * restrictions. Survives billing being switched on later - this is the flag
   * that guarantees our own dogfooding account can never be charged.
   */
  internal?: boolean;
  /** Per-tenant NPA override for Verify (defaults to US+CA). */
  verifyAllowedNpas?: string[];
  /** Free-tier send targets, keyed by 10-digit. */
  verifiedRecipients?: Record<string, VerifiedRecipient>;
}

export interface ApiKeyRecord {
  tenantId: string;
  keyId: string;
  mode: KeyMode;
  prefix: string; // display prefix e.g. "ghost_sk_test_a1b2"
  name: string;
  createdAt: number;
  lastUsedAt?: number;
  revokedAt?: number;
  // Reserved for future granular permissions; empty/absent = full access.
  scopes?: string[];
}

export interface ApiContext {
  tenantId: string;
  tenant: ApiTenant;
  uid: string;
  keyHash: string;
  keyId: string;
  mode: KeyMode;
}

export type MessageDirection = 'outbound' | 'inbound';
export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'received';

export interface PublicMessage {
  id: string;
  object: 'message';
  to: string;
  from: string;
  body: string;
  direction: MessageDirection;
  status: MessageStatus;
  test: boolean;
  created_at: string; // ISO
  /** MMS attachments (inbound today; outbound is carrier-gated). */
  media?: string[];
  /** Display name of the console user or API key that composed it. */
  sent_by?: string;
  /** Present when a send failed and the carrier said why. */
  failure_reason?: string;
}

export type ApiEventType =
  | 'message.sent'
  | 'message.delivered'
  | 'message.failed'
  | 'message.received'
  | 'number.purchased'
  | 'number.released'
  | 'verification.sent'
  | 'verification.approved'
  | 'verification.failed'
  | 'verification.blocked'
  | 'verification.sent_to_opted_out'
  | 'message.opted_out'
  | 'message.opted_in'
  | 'broadcast.complete';

export interface PublicEvent {
  id: string;
  object: 'event';
  type: ApiEventType;
  created_at: string;
  data: Record<string, unknown>;
}
