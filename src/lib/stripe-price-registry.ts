// ─── Stripe price registry — SINGLE SOURCE OF TRUTH for price → product type ───
//
// Every Ghost price ID and what it controls in Firebase. Categorizations
// validated by Austin 2026-07-13 (full active-price inventory diffed against
// the webhook env lists + the purge/audit hardcoded sets, which had drifted).
//
// Consumers: src/app/api/webhook/route.ts (getSubscriptionType),
// functions/sinch-number-purge/{local-runner,audit-subscribed-status}.js
// (via requiring this file's compiled sibling or duplicating REGISTRY — keep
// in sync), and any future route that needs to know what a price is.
//
// The Stripe account is SHARED with non-Ghost businesses (Truepicks,
// PrivacyAI, "Unlimited Access", Settlebuddy, …). Prices known to be
// non-Ghost are listed under `irrelevant` so they resolve explicitly and
// never depend on the fallback. Per Austin's call (2026-07-13), UNKNOWN
// price IDs still default to 'main' for backwards compatibility — so any
// NEW Ghost price MUST be added here (or at least to the env lists) at
// creation time, and a new non-Ghost product should be added to
// `irrelevant`.

export type SubscriptionType =
  | 'main'
  | 'bundle' // all-in-one: main + multiPlan + vpnUpgrade + spamBlocker in ONE subscription
  | 'multiplan'
  | 'multiplanpluspro'
  | 'vpn'
  | 'spamblocker'
  | 'ghostchat'
  | 'irrelevant' // non-Ghost product on the shared Stripe account — never touch Firebase
  | 'unknown';

const MAIN: string[] = [
  'price_1SAGEPFav0fFJeoIVs5UeMpG', // $60 / 2mo — CURRENT main (STRIPE_PRICE_ID)
  'price_1SVCx8Fav0fFJeoIDkW8Aorn', // $60 / 2mo (STRIPE_WEB_APP_PRICE_ID)
  'price_1SoSkWFav0fFJeoIP303LzJj', // $60 / 2mo (STRIPE_FB_PRICE_ID)
  'price_1RYngGFav0fFJeoIa4QWV8kE', // $48 / 2mo (STRIPE_FOURTH_PRICE_ID + STRIPE_PRICE_ID_OLD)
  'price_1RWZ7nFav0fFJeoI9xz3mJlB', // $48 / 2mo — older main, was fallback-only
  'price_1RYnvpFav0fFJeoI57Kmrcpb', // $24.99 / 2mo (STRIPE_FIFTH_PRICE_ID)
  'price_1Rh9lsFav0fFJeoIq2qlAWyx', // $24 / 2mo (STRIPE_SECONDARY_PRICE_ID)
  'price_1RtKbDFav0fFJeoI8NLHp7E4', // $144 / yr (STRIPE_TERTIARY_PRICE_ID)
  'price_1RxqukFav0fFJeoIWoxtr2mN', // $89 / yr — was fallback-only
  'price_1SCj06Fav0fFJeoI67nizkP9', // $144 / yr Angel (STRIPE_ANGEL_PRICE_ID)
  'price_1S0n35Fav0fFJeoIBnE2Ls2g', // $1 / mo (STRIPE_ONE_PRICE_ID)
  'price_1NCjS9Fav0fFJeoIL5zIUdDd', // $47 / wk legacy "Unlimited Premium Access" (STRIPE_SIXTH_PRICE_ID) — main per Austin
];

// All-in-one bundles: ONE subscription that carries the base sub AND the
// bundled upgrades. Cancellation must clear every bundled flag — registering
// these as plain 'main' would leave multiPlan/vpnUpgrade/spamBlocker = 1 on a
// canceled user (free upgrades if they ever resubscribe base-only).
const BUNDLE: string[] = [
  'price_1TvfueFav0fFJeoIoddAy9dp', // $29.99 / mo "Ghost Premium 15 Numbers" (v2 funnel, 2026-07-21)
];

const MULTIPLAN: string[] = [
  'price_1SVw7tFav0fFJeoIjCt5fDny', // $19.95 one-time (STRIPE_UPGRADE_PRICE_ID)
  'price_1SaIZeFav0fFJeoIZGyOXJ4g', // $19.95 / mo (STRIPE_MULTI_PLAN_PLUS_PRICE_ID)
  'price_1TIAJRFav0fFJeoIPGJODFAR', // $19.95 / 2mo (STRIPE_MULTI_PLAN_NEW_PRICE_ID)
];

const MULTIPLAN_PLUS_PRO: string[] = [
  'price_1ScsfkFav0fFJeoIq0rpgQ71', // $19.95 one-time (STRIPE_MULTI_PLAN_PLUS_PRO_PRICE_ID)
  'price_1TIALLFav0fFJeoIB4ue4QGl', // $19.95 / 2mo (STRIPE_MULTI_PLAN_PRO_NEW_PRICE_ID)
  'price_1ScT3QFav0fFJeoITKBGy5nj', // $19.95 / mo — "multiplanplus upgrade" per Austin (⚠️ confirm: multiPlanPlus, not multiPlan)
];

const VPN: string[] = [
  'price_1TEd9bFav0fFJeoIqRGIe0jU', // $1 / wk (STRIPE_VPN_UPGRADE_PRICE_ID)
  'price_1SfBC5Fav0fFJeoISPaMcYwK', // $19.95 / 2mo (STRIPE_SECONDARY_VPN_UPGRADE_PRICE_ID)
  'price_1TD4FPFav0fFJeoIhdtxNksj', // $4.99 / 2mo (STRIPE_THIRD_VPN_UPGRADE_PRICE_ID)
  'price_1ScsUEFav0fFJeoI59fnYJFN', // $14.95 one-time — VPN upgrade per Austin
];

const SPAM_BLOCKER: string[] = [
  'price_1TD4GDFav0fFJeoIMo2l5vRg', // $2.99 / 2mo (STRIPE_SPAM_BLOCKER_PRICE_ID)
  'price_1SuMGKFav0fFJeoIQIpHZFVh', // $5 / 2mo — spam blocker per Austin (was fallback-only → cancel flipped MAIN!)
];

const GHOST_CHAT: string[] = [
  'price_1TLlTQFav0fFJeoIBfieVR1H', // $19.95 / 2mo (STRIPE_GHOST_CHAT_PRICE_ID) — feature not in app yet
];

// Non-Ghost / retired prices on the shared account, per Austin 2026-07-13.
// Explicit so they never fall through to 'main'.
const IRRELEVANT: string[] = [
  'price_1RYnrnFav0fFJeoIdbJl930K', // $1 / mo Ghost (retired)
  'price_1RYnuVFav0fFJeoIKnr7PVmy', // $29.99 / 2mo Ghost (retired)
  'price_1RdcS1Fav0fFJeoIGlv3krj3', // $300 / yr Ghost (retired)
  'price_1SQevKFav0fFJeoIJ03v8kAE', // $11.59 / mo (NEXT_PUBLIC 1MONTH trio)
  'price_1SQewoFav0fFJeoIqdIfPEFf', // $16.98 / 3mo
  'price_1SQeyFFav0fFJeoI4QVGAIZA', // $49.99 / yr
  'price_1Sq18SFav0fFJeoIvZhLToio', // $9.99 / mo (STRIPE_PRICE_1)
  'price_1Sq195Fav0fFJeoIv7rFgyJr', // $19.99 / 3mo (STRIPE_PRICE_2)
  'price_1Sq19bFav0fFJeoIH7BwUPll', // $60 / yr (STRIPE_PRICE_3)
  'price_1SaJIuFav0fFJeoIr9KCJ4yR', // $4.99 / mo Ghost (retired)
  'price_1TpcFIFav0fFJeoIPimRopHc', // $29.95 / mo Ghost (retired)
];

const REGISTRY = new Map<string, SubscriptionType>();
for (const [type, ids] of [
  ['main', MAIN],
  ['bundle', BUNDLE],
  ['multiplan', MULTIPLAN],
  ['multiplanpluspro', MULTIPLAN_PLUS_PRO],
  ['vpn', VPN],
  ['spamblocker', SPAM_BLOCKER],
  ['ghostchat', GHOST_CHAT],
  ['irrelevant', IRRELEVANT],
] as [SubscriptionType, string[]][]) {
  for (const id of ids) REGISTRY.set(id, type);
}

/** Explicit lookup only — returns 'unknown' when the price isn't registered.
 *  Callers decide the fallback policy (the webhook keeps unknown→main). */
export function lookupPriceType(priceId: string | null | undefined): SubscriptionType {
  if (!priceId) return 'unknown';
  return REGISTRY.get(priceId) ?? 'unknown';
}

/** Firebase flag(s) a subscription type controls. 'irrelevant'/'unknown' → []. */
export function firebaseFieldsForType(type: SubscriptionType): string[] {
  switch (type) {
    case 'main':
      return ['subscribed'];
    case 'bundle':
      return ['subscribed', 'multiPlan', 'vpnUpgrade', 'spamBlocker'];
    case 'multiplan':
      return ['multiPlan'];
    case 'multiplanpluspro':
      return ['multiPlanPlus'];
    case 'vpn':
      return ['vpnUpgrade'];
    case 'spamblocker':
      return ['spamBlocker'];
    case 'ghostchat':
      return ['ghostChat'];
    default:
      return [];
  }
}
