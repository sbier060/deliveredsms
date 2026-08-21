import { db } from '@/lib/firebase-admin';
import { digits10 } from '@/lib/api/phone';

/**
 * STOP / START / HELP handling.
 *
 * Scope is per-tenant: a recipient who replies STOP silences the tenant that
 * texted them and nobody else. A global registry would mean unsubscribing from
 * one sender also kills your login codes from an unrelated one, which is a
 * worse failure than the one it prevents. It is also what makes sandbox
 * enforcement possible - +1 500-555-0006 is the canonical sandbox destination,
 * and a global opt-out on it would permanently break every developer's tests.
 */

export type InboundIntent = 'opt_out' | 'opt_in' | 'help' | null;

/** How a consent change was detected or asserted. */
export type ConsentMethod = 'keyword' | 'phrase' | 'ai' | 'api' | 'import';

export interface ConsentEntry {
  at: number;
  type: 'opt_out' | 'opt_in' | 'exempt_send' | 'import' | 'api_set';
  via: string;
  method?: ConsentMethod;
  keyword?: string;
  confidence?: number;
  sourceMessageId?: string;
  note?: string;
}

/** CTIA-standard keyword sets. */
const OPT_OUT = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);
const OPT_IN = new Set(['START', 'UNSTOP', 'YES']);
const HELP = new Set(['HELP', 'INFO']);

/**
 * Classify an inbound body.
 *
 * The message must BE the keyword, not merely contain it. "please stop by
 * tomorrow" and "stopwatch" are ordinary messages; unsubscribing on those is
 * both wrong and, once it happens, invisible to the sender. Punctuation and
 * surrounding whitespace are stripped because handsets and users add both.
 */
export function classify(body: string): InboundIntent {
  const word = body
    .trim()
    .toUpperCase()
    .replace(/[.,!?;:'"()\[\]]/g, '')
    .trim();

  if (OPT_OUT.has(word)) return 'opt_out';
  if (OPT_IN.has(word)) return 'opt_in';
  if (HELP.has(word)) return 'help';
  return null;
}

/**
 * Reasonable-means revocation, tier 2: plain-English phrases.
 *
 * The FCC's April 2025 revocation rule requires honoring revocation expressed
 * in any reasonable manner, not just the CTIA keywords. This tier catches the
 * common verb+object forms deterministically. A bare keyword buried in an
 * unrelated sentence ("we should stop by the store") must NOT match - every
 * pattern requires the messaging-directed form.
 */
const REVOCATION_PHRASES: RegExp[] = [
  /\bunsubscribe\b/,
  /\b(remove|take)\s+me\s+(off|from)\b/,
  /\bopt\s*(me\s*)?out\b/,
  /\b(do\s*not|don'?t|never|stop|quit|please\s+stop)\s+(text|txt|message|messag|contact|sms)/,
  /\b(stop|quit|end)\s+(texting|messaging|contacting|sending)\b/,
  /\bno\s+more\s+(texts?|messages?|msgs?|sms)\b/,
  /\bstop\s+sending\b/,
  /\bleave\s+me\s+alone\b/,
  /\blose\s+my\s+number\b/,
];

const PHRASE_TIER_MAX_LENGTH = 300;

/**
 * Tier-2 detection: does this body express revocation in plain English?
 * Runs only when the exact-keyword tier missed. Deterministic and instant.
 */
export function classifyRevocationPhrase(body: string): { hit: boolean; phrase?: string } {
  const text = body.trim().toLowerCase();
  if (!text || text.length > PHRASE_TIER_MAX_LENGTH) return { hit: false };
  for (const re of REVOCATION_PHRASES) {
    const m = re.exec(text);
    if (m) return { hit: true, phrase: m[0] };
  }
  return { hit: false };
}

const key = (tenantId: string, phone: string) =>
  `apiOptOut/${tenantId}/${digits10(phone)}`;

const optInKey = (tenantId: string, phone: string) =>
  `apiOptIn/${tenantId}/${digits10(phone)}`;

const ledgerRef = (tenantId: string, phone: string) =>
  db.ref(`apiConsentLog/${tenantId}/${digits10(phone)}`);

/** Append-only consent history. Best-effort: never blocks enforcement. */
async function appendLedger(
  tenantId: string,
  phone: string,
  entry: ConsentEntry
): Promise<void> {
  try {
    // RTDB rejects undefined values; strip them the same way storeMessage does.
    await ledgerRef(tenantId, phone).push(JSON.parse(JSON.stringify(entry)));
  } catch {
    /* the enforcement record is the source of truth; the ledger is audit */
  }
}

/**
 * Has this recipient opted out of this tenant's messages?
 *
 * Also consults the legacy global `apiVerifyOptOut` node so anything already
 * recorded there keeps being honoured.
 */
export async function hasOptedOut(tenantId: string, phone: string): Promise<boolean> {
  try {
    const [scoped, legacy, optIn] = await Promise.all([
      db.ref(key(tenantId, phone)).get(),
      db.ref(`apiVerifyOptOut/${digits10(phone)}`).get(),
      db.ref(optInKey(tenantId, phone)).get(),
    ]);
    if (scoped.exists()) return true;
    // The legacy global is shared with the consumer app and never mutated from
    // here. Without this check it is a one-way trap: a legacy-listed number
    // could never opt back in. A tenant-scoped opt-in record outranks it.
    if (legacy.exists() && !optIn.exists()) return true;
    return false;
  } catch {
    // Fail open. An RTDB blip must not block a login code; the alternative is
    // locking users out of their accounts during an outage.
    return false;
  }
}

export async function recordOptOut(
  tenantId: string,
  phone: string,
  via: string,
  sourceMessageId?: string,
  extra?: { method?: ConsentMethod; keyword?: string; confidence?: number; note?: string }
): Promise<void> {
  const at = Date.now();
  await db.ref(key(tenantId, phone)).set({
    at,
    via,
    ...(sourceMessageId ? { sourceMessageId } : {}),
    ...(extra?.method ? { method: extra.method } : {}),
    ...(extra?.keyword ? { keyword: extra.keyword.slice(0, 80) } : {}),
    ...(extra?.confidence !== undefined ? { confidence: extra.confidence } : {}),
  });
  // A fresh opt-out supersedes any prior opt-in marker.
  await db.ref(optInKey(tenantId, phone)).remove().catch(() => undefined);
  await appendLedger(tenantId, phone, {
    at,
    type: 'opt_out',
    via,
    method: extra?.method,
    keyword: extra?.keyword?.slice(0, 80),
    confidence: extra?.confidence,
    sourceMessageId,
    note: extra?.note,
  });
}

/**
 * Opt a number back in: lifts enforcement, records a tenant-scoped opt-in
 * marker (which also outranks the legacy global list), and appends to the
 * ledger. Nothing is ever deleted from the history.
 */
export async function recordOptIn(
  tenantId: string,
  phone: string,
  via: string,
  extra?: { method?: ConsentMethod; keyword?: string; note?: string }
): Promise<void> {
  const at = Date.now();
  await db.ref(key(tenantId, phone)).remove();
  await db.ref(optInKey(tenantId, phone)).set({ at, via });
  await appendLedger(tenantId, phone, {
    at,
    type: 'opt_in',
    via,
    method: extra?.method,
    keyword: extra?.keyword?.slice(0, 80),
    note: extra?.note,
  });
}

/** @deprecated use recordOptIn - kept for existing call sites. */
export async function clearOptOut(tenantId: string, phone: string): Promise<void> {
  await recordOptIn(tenantId, phone, 'keyword');
}

/** Current consent state plus recent append-only history for one number. */
export async function consentStatus(
  tenantId: string,
  phone: string
): Promise<'opted_out' | 'opted_in' | 'no_record'> {
  if (await hasOptedOut(tenantId, phone)) return 'opted_out';
  try {
    const optIn = await db.ref(optInKey(tenantId, phone)).get();
    return optIn.exists() ? 'opted_in' : 'no_record';
  } catch {
    return 'no_record';
  }
}

export async function consentHistory(
  tenantId: string,
  phone: string,
  limit = 50
): Promise<ConsentEntry[]> {
  try {
    const snap = await ledgerRef(tenantId, phone).orderByKey().limitToLast(limit).get();
    if (!snap.exists()) return [];
    const rows: ConsentEntry[] = [];
    snap.forEach((child) => {
      rows.push(child.val() as ConsentEntry);
    });
    return rows.reverse(); // newest first
  } catch {
    return [];
  }
}

/**
 * Record that a verification was sent to a number that had opted out.
 *
 * One-time passcodes are exempt: the user is asking for the code by trying to
 * log in, and blocking it locks them out of their own account. The exemption is
 * written down rather than applied silently, so the pattern is auditable if a
 * carrier ever asks why traffic went to an opted-out handset.
 */
export async function logOptOutOverride(
  tenantId: string,
  phone: string,
  reason: string
): Promise<void> {
  try {
    const at = Date.now();
    await db.ref(`apiOptOutOverride/${tenantId}/${digits10(phone)}`).push({
      at,
      reason,
    });
    // Exemptions are part of the number's consent history too, so a single
    // ledger export answers "what did we ever send this person and why".
    await appendLedger(tenantId, phone, { at, type: 'exempt_send', via: reason });
  } catch {
    // Best-effort audit trail; never block the send on it.
  }
}

export interface SuppressionRow {
  phone: string; // digits10
  at: number;
  via: string;
  method?: ConsentMethod;
  keyword?: string;
  confidence?: number;
}

/**
 * Page through the tenant's suppression list. Keys are digits10, so
 * orderByKey gives stable numeric-order pagination without an index.
 */
export async function listSuppressions(
  tenantId: string,
  opts: { limit: number; cursor?: string | null }
): Promise<{ data: SuppressionRow[]; hasMore: boolean; nextCursor: string | null }> {
  let query = db.ref(`apiOptOut/${tenantId}`).orderByKey();
  if (opts.cursor) query = query.startAfter(opts.cursor);
  const snap = await query.limitToFirst(opts.limit + 1).get();
  const rows: SuppressionRow[] = [];
  snap.forEach((child) => {
    const v = child.val() as Omit<SuppressionRow, 'phone'>;
    rows.push({ phone: child.key as string, ...v });
  });
  const hasMore = rows.length > opts.limit;
  const data = hasMore ? rows.slice(0, opts.limit) : rows;
  return {
    data,
    hasMore,
    nextCursor: hasMore ? data[data.length - 1].phone : null,
  };
}

/** The one message allowed to a number that just opted out. */
export function confirmationBody(brand = 'Resms'): string {
  return `You have been unsubscribed and will receive no further messages from ${brand}. Reply START to resubscribe.`;
}

export function helpBody(brand = 'Resms'): string {
  return `${brand}: for help, contact support@resms.com. Reply STOP to unsubscribe.`;
}
