/**
 * Delivered pricing - the single source of truth.
 *
 * Imported by the pricing page, the estimator, the docs generator, the console
 * billing page, and (later) the Stripe bootstrap script. Change a number here
 * and everything downstream follows. Deliberately dependency-free so it is
 * safe in server components, client components, and plain node scripts.
 *
 * Money is integer MICRO-DOLLARS (millionths of a dollar) - never floats.
 * $0.005 = 5_000. Stripe wants `unit_amount_decimal` as a string of cents:
 * microUsd / 10_000 → "0.5". Exact for every rate we publish.
 */

export type MeterName =
  | 'outbound_sms'
  | 'inbound_sms'
  | 'lookups'
  | 'spam_scores'
  | 'verifications';
export type BillableUnit = MeterName | 'numbers';
export type PlanId = 'free' | 'payg' | 'pro' | 'scale';

export interface UnitRate {
  unit: BillableUnit;
  label: string;
  per: string;
  microUsd: number;
  billing: 'metered' | 'licensed';
  meter?: MeterName;
  note?: string;
}

export const RATES: Record<BillableUnit, UnitRate> = {
  outbound_sms: {
    unit: 'outbound_sms',
    label: 'Outbound SMS',
    per: 'per message',
    microUsd: 5_000,
    billing: 'metered',
    meter: 'outbound_sms',
  },
  inbound_sms: {
    unit: 'inbound_sms',
    label: 'Inbound SMS',
    per: 'per message',
    microUsd: 4_000,
    billing: 'metered',
    meter: 'inbound_sms',
    note: 'Free until inbound webhooks ship.',
  },
  numbers: {
    unit: 'numbers',
    label: 'Phone number',
    per: 'per number, per month',
    microUsd: 950_000,
    billing: 'licensed',
  },
  lookups: {
    unit: 'lookups',
    label: 'Carrier lookup',
    per: 'per lookup',
    microUsd: 8_000,
    billing: 'metered',
    meter: 'lookups',
  },
  verifications: {
    unit: 'verifications',
    label: 'Phone verification',
    per: 'per successful verification',
    microUsd: 25_000,
    billing: 'metered',
    meter: 'verifications',
    note: 'Only charged when a code is actually verified. Blocked and abandoned attempts are free.',
  },
  spam_scores: {
    unit: 'spam_scores',
    label: 'Spam score',
    per: 'per check',
    microUsd: 4_000,
    billing: 'metered',
    meter: 'spam_scores',
  },
};

/**
 * Free tier - Resend's shape scaled to SMS economics. Resend gives 3,000
 * emails/mo + 100/day + 1 domain + 30-day retention with no card; at our unit
 * costs the equivalent exposure (~$1.15/user/month) is 100 SMS + 1 number.
 * Their "verify a domain before you can send anywhere" restriction maps to our
 * verified-recipient gate. No free live lookups - those cost us real money.
 */
export const FREE_TIER = {
  outboundSmsPerMonth: 100,
  outboundSmsPerDay: 10,
  numbersMax: 1,
  lookupsPerDay: 0,
  lookupsPerMonth: 0,
  verificationsPerMonth: 10,
  retentionDays: 30,
  requiresCard: false,
  verifiedRecipientsOnly: true,
  maxVerifiedRecipients: 3,
} as const;

/** Abuse ceilings for paid accounts - not sold as limits; raised on request. */
export const PAYG_CEILINGS = {
  messagesPerDay: 10_000,
  lookupsPerDay: 5_000,
  verificationsPerDay: 2_000,
  numbersMax: 100,
} as const;

export interface Plan {
  id: PlanId;
  name: string;
  priceLine: string;
  tagline: string;
  features: string[];
  cta: { label: string; href: string } | null;
  contactOnly: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    priceLine: '$0',
    tagline: 'No credit card.',
    features: [
      `${FREE_TIER.outboundSmsPerMonth} live texts a month, ${FREE_TIER.outboundSmsPerDay} a day`,
      `${FREE_TIER.numbersMax} phone number`,
      "Texts go to numbers you've verified",
      'Unlimited sandbox: every endpoint, no caps',
      `${FREE_TIER.retentionDays}-day log retention`,
    ],
    cta: { label: 'Start free', href: '/console' },
    contactOnly: false,
  },
  {
    id: 'payg',
    name: 'Pay as you go',
    priceLine: '$0.005 / text',
    tagline: 'Add a card, send to anyone.',
    features: [
      'Everything in Free',
      'No monthly cap, no daily cap',
      'Numbers at $0.95/mo, prorated',
      'Carrier lookups and spam scores',
      'One usage invoice on the 1st',
    ],
    cta: { label: 'Add a card', href: '/console/billing' },
    contactOnly: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLine: 'Contact us',
    tagline: 'Committed volume, discounted rates, priority routing.',
    features: [],
    cta: { label: 'Talk to us', href: '/contact-us' },
    contactOnly: true,
  },
  {
    id: 'scale',
    name: 'Scale',
    priceLine: 'Contact us',
    tagline: 'Custom carrier routes, SLA, invoicing, SSO.',
    features: [],
    cta: { label: 'Talk to us', href: '/contact-us' },
    contactOnly: true,
  },
];

/**
 * Competitor rates. Every row carries provenance - a stale table on a public
 * pricing page is a legal problem, not a copy problem. Re-verify quarterly.
 */
export const COMPETITORS_CHECKED_ON = 'August 2026';

export interface CompetitorRow {
  provider: string;
  headlineMicroUsd: number;
  /** Carrier pass-through band, or null when not published as a flat band. */
  carrierFeeMicroUsd: [number, number] | null;
  allInMicroUsd: [number, number];
  numberMicroUsd: number;
  sourceUrl: string;
  caveat?: string;
}

export const COMPETITORS: CompetitorRow[] = [
  {
    provider: 'Twilio',
    headlineMicroUsd: 8_300,
    carrierFeeMicroUsd: [2_500, 5_000],
    allInMicroUsd: [10_800, 13_300],
    numberMicroUsd: 1_150_000,
    sourceUrl: 'https://www.twilio.com/en-us/sms/pricing/us',
  },
  {
    provider: 'Telnyx',
    headlineMicroUsd: 4_000,
    carrierFeeMicroUsd: [3_500, 4_500],
    allInMicroUsd: [7_500, 8_500],
    numberMicroUsd: 1_000_000,
    sourceUrl: 'https://telnyx.com/pricing/messaging',
    caveat: 'Lowest headline rate, but carrier fees put its all-in above ours.',
  },
  {
    provider: 'Plivo',
    headlineMicroUsd: 7_700,
    carrierFeeMicroUsd: null,
    allInMicroUsd: [7_700, 12_700],
    numberMicroUsd: 500_000,
    sourceUrl: 'https://www.plivo.com/sms/pricing/us/',
    caveat: 'Cheaper numbers than ours. Carrier surcharges not published as a flat band.',
  },
];

// ── formatting ──────────────────────────────────────────────────────────────

/** 5_000 → "0.5" (a string of CENTS, for Stripe unit_amount_decimal). */
export function toStripeUnitAmountDecimal(microUsd: number): string {
  const cents = microUsd / 10_000;
  return String(Number(cents.toFixed(6)));
}

/** 5_000 → "$0.005". Trims to the shortest exact representation. */
export function formatRate(microUsd: number): string {
  const dollars = microUsd / 1_000_000;
  const str = dollars.toFixed(6).replace(/0+$/, '');
  return `$${str.endsWith('.') ? `${str}00` : str}`;
}

/** 1_740_000 → "$1.74" (2dp, for totals). */
export function formatMoney(microUsd: number): string {
  return `$${(microUsd / 1_000_000).toFixed(2)}`;
}

export function formatRange(range: [number, number], fmt = formatRate): string {
  return range[0] === range[1] ? fmt(range[0]) : `${fmt(range[0])}–${fmt(range[1])}`;
}

// ── estimation ──────────────────────────────────────────────────────────────

export interface UsageInput {
  outboundSms?: number;
  inboundSms?: number;
  numbers?: number;
  lookups?: number;
  spamScores?: number;
}

export interface CostLine {
  unit: BillableUnit;
  label: string;
  quantity: number;
  microUsd: number;
  subtotalMicroUsd: number;
}

export interface CostEstimate {
  lines: CostLine[];
  subtotalMicroUsd: number;
}

const INPUT_TO_UNIT: Array<[keyof UsageInput, BillableUnit]> = [
  ['outboundSms', 'outbound_sms'],
  ['inboundSms', 'inbound_sms'],
  ['numbers', 'numbers'],
  ['lookups', 'lookups'],
  ['spamScores', 'spam_scores'],
];

export function estimateCost(usage: UsageInput): CostEstimate {
  const lines: CostLine[] = [];
  for (const [key, unit] of INPUT_TO_UNIT) {
    const quantity = usage[key] || 0;
    if (quantity <= 0) continue;
    const rate = RATES[unit];
    lines.push({
      unit,
      label: rate.label,
      quantity,
      microUsd: rate.microUsd,
      subtotalMicroUsd: quantity * rate.microUsd,
    });
  }
  return {
    lines,
    subtotalMicroUsd: lines.reduce((sum, l) => sum + l.subtotalMicroUsd, 0),
  };
}

/**
 * The same usage on a competitor, as a [low, high] band. Messaging uses their
 * all-in band; numbers use their published rate. Lookups/spam are excluded -
 * their lookup products aren't comparable line-for-line.
 */
export function estimateCompetitorCost(
  usage: UsageInput,
  row: CompetitorRow
): [number, number] {
  const messages = (usage.outboundSms || 0) + (usage.inboundSms || 0);
  const numbers = (usage.numbers || 0) * row.numberMicroUsd;
  return [
    messages * row.allInMicroUsd[0] + numbers,
    messages * row.allInMicroUsd[1] + numbers,
  ];
}

// ── docs generation (keeps markdown from drifting from the page) ────────────

export function pricingTableMarkdown(): string {
  const rows = (Object.values(RATES) as UnitRate[])
    .map((r) => `| ${r.label} | **${formatRate(r.microUsd)}** | ${r.per} |`)
    .join('\n');
  return `| | Price | |
| --- | --- | --- |
${rows}

US & Canada long code. Billed monthly in arrears, in USD. A2P 10DLC
registration is included; we register on your behalf, there's nothing extra to
pay and nothing to wait for. You're billed when the carrier accepts the
message: failed sends cost nothing.`;
}

export function freeTierMarkdown(): string {
  return `The free tier needs no credit card:

- **${FREE_TIER.outboundSmsPerMonth} live outbound SMS per month** (${FREE_TIER.outboundSmsPerDay} per day)
- **${FREE_TIER.numbersMax} phone number**
- Live texts go only to numbers you've verified (up to ${FREE_TIER.maxVerifiedRecipients})
- **Unlimited sandbox**: every endpoint, no caps, no card, no verification
- ${FREE_TIER.retentionDays}-day log retention

Add a payment method to lift every cap, text anyone, and unlock live carrier
lookups and spam scores.`;
}
