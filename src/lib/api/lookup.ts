import { db } from '@/lib/firebase-admin';
import { digits10 } from './phone';

/**
 * Phone lookup on Twilio Lookups v2 (the only genuinely defensible data
 * source - pattern from src/app/api/lookup/[number]/enrich/route.ts).
 * Results are cached 24h in apiLookupCache to cut Twilio spend.
 *
 * NEVER touch src/lib/phone-enrichment.ts - that data is synthetic.
 */

export interface LookupResult {
  phone_number: string;
  valid: boolean;
  line_type: string | null;
  carrier: { name: string | null; type: string | null };
  caller_name: string | null;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function lookupPhone(e164: string): Promise<LookupResult | null> {
  const key = digits10(e164);
  const cacheRef = db.ref(`apiLookupCache/${key}`);
  const cached = await cacheRef.get();
  if (cached.exists()) {
    const { data, cachedAt } = cached.val() as {
      data: LookupResult;
      cachedAt: number;
    };
    if (Date.now() - cachedAt < CACHE_TTL_MS) return data;
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.error('[api/lookup] Twilio credentials not configured');
    return null;
  }

  // line_type_intelligence ONLY. caller_name is billed separately by Twilio
  // (~$0.01 vs ~$0.005) and requesting both put the lookup above its own sale
  // price. Caller name returns as a paid add-on field later.
  const res = await fetch(
    `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(
      e164
    )}?Fields=line_type_intelligence`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      },
    }
  );
  if (!res.ok) {
    if (res.status === 404) {
      return {
        phone_number: e164,
        valid: false,
        line_type: null,
        carrier: { name: null, type: null },
        caller_name: null,
      };
    }
    console.error('[api/lookup] Twilio error', res.status);
    return null;
  }

  const data = (await res.json()) as {
    valid?: boolean;
    line_type_intelligence?: {
      type?: string;
      carrier_name?: string;
    } | null;
    caller_name?: { caller_name?: string } | null;
  };

  const result: LookupResult = {
    phone_number: e164,
    valid: data.valid !== false,
    line_type: data.line_type_intelligence?.type ?? null,
    carrier: {
      name: data.line_type_intelligence?.carrier_name ?? null,
      type: data.line_type_intelligence?.type ?? null,
    },
    caller_name: data.caller_name?.caller_name ?? null,
  };

  cacheRef.set({ data: result, cachedAt: Date.now() }).catch(() => {});
  return result;
}

export interface SpamResult {
  phone_number: string;
  spam_score: number;
  spam_type: string | null;
  severity: string | null;
  last_reported_at: string | null;
  reports: number;
}

/**
 * Aggregate spam signal from a 400k-download consumer phone app's real detections
 * (spamMessages/{digits10}, written by spamMessageDetector for score >= 70).
 * Returns AGGREGATES ONLY - the underlying records contain user message text
 * and must never leave this function.
 */
export async function lookupSpam(e164: string): Promise<SpamResult> {
  const empty: SpamResult = {
    phone_number: e164,
    spam_score: 0,
    spam_type: null,
    severity: null,
    last_reported_at: null,
    reports: 0,
  };
  const snap = await db.ref(`spamMessages/${digits10(e164)}`).get();
  if (!snap.exists()) return empty;

  const val = snap.val() as Record<string, unknown>;
  // Node may hold a single record or a keyed collection of records.
  const records: Array<Record<string, unknown>> =
    typeof val.spamScore === 'number' || typeof val.detectedAt !== 'undefined'
      ? [val]
      : Object.values(val).filter(
          (v): v is Record<string, unknown> => typeof v === 'object' && v !== null
        );
  if (records.length === 0) return empty;

  let top: Record<string, unknown> | null = null;
  let lastAt = 0;
  for (const r of records) {
    const score = typeof r.spamScore === 'number' ? r.spamScore : 0;
    if (!top || score > ((top.spamScore as number) || 0)) top = r;
    const at = typeof r.detectedAt === 'number' ? r.detectedAt : 0;
    if (at > lastAt) lastAt = at;
  }

  return {
    phone_number: e164,
    spam_score: (top?.spamScore as number) || 0,
    spam_type: (top?.callType as string) || (top?.spamType as string) || null,
    severity: (top?.severity as string) || null,
    last_reported_at: lastAt ? new Date(lastAt).toISOString() : null,
    reports: records.length,
  };
}
