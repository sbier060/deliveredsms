import { createHmac } from 'crypto';
import { db } from '@/lib/firebase-admin';
import { newEndpointId, newWebhookSecret, newEventId } from './ids';
import type { ApiEventType, PublicEvent } from './types';

/**
 * Webhook delivery — the push half of the event system (events.ts is the
 * store half; emitEvent calls deliverEvent after every write).
 *
 * Storage:
 *   apiWebhooks/{tenantId}/{endpointId}            = WebhookEndpoint
 *   apiWebhookOutbox/{pushKey}                     = RetryJob (failed deliveries)
 *   apiWebhookDeliveries/{tenantId}/{endpointId}/  = push log (console reads last 20)
 *
 * Every request is signed: `dsms-signature: t=<unix seconds>,v1=<hex>` where
 * v1 = HMAC-SHA256(secret, `${t}.${rawBody}`). Same scheme Stripe uses, so
 * every "verify a Stripe webhook" snippet on the internet adapts in one line.
 */

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: '*' | ApiEventType[];
  secret: string; // whsec_...
  active: boolean;
  createdAt: number;
  description?: string;
}

interface RetryJob {
  tenantId: string;
  endpointId: string;
  event: PublicEvent;
  attempts: number; // deliveries attempted so far (>= 1 when enqueued)
  nextAt: number;
}

export const MAX_ENDPOINTS_PER_TENANT = 5;

/** Console-facing shape. The signing secret is intentionally included — the
 * developer needs it to verify signatures, and the console routes that call
 * this are behind auth. */
export function publicEndpoint(e: WebhookEndpoint) {
  return {
    id: e.id,
    url: e.url,
    events: e.events,
    secret: e.secret,
    active: e.active,
    createdAt: e.createdAt,
    description: e.description ?? null,
  };
}
const DELIVERY_TIMEOUT_MS = 5_000;
/** Backoff after the inline attempt fails: 1m, 5m, 30m, 2h, 12h — then drop. */
const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];

/**
 * Reject URLs that could reach our own infrastructure (SSRF). String-level
 * checks only — good enough to stop the obvious cases; the API runs with no
 * privileged network peers anyway.
 */
export function validateEndpointUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'Not a valid URL.';
  }
  if (url.protocol !== 'https:') return 'Webhook URLs must use https.';
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return 'Webhook URLs must be publicly reachable.';
  }
  return null;
}

export async function listEndpoints(tenantId: string): Promise<WebhookEndpoint[]> {
  const snap = await db.ref(`apiWebhooks/${tenantId}`).get();
  if (!snap.exists()) return [];
  return Object.values(snap.val() as Record<string, WebhookEndpoint>).sort(
    (a, b) => a.createdAt - b.createdAt
  );
}

export async function getEndpoint(
  tenantId: string,
  endpointId: string
): Promise<WebhookEndpoint | null> {
  const snap = await db.ref(`apiWebhooks/${tenantId}/${endpointId}`).get();
  return snap.exists() ? (snap.val() as WebhookEndpoint) : null;
}

export async function createEndpoint(
  tenantId: string,
  url: string,
  events: '*' | ApiEventType[] = '*',
  description?: string
): Promise<WebhookEndpoint> {
  const endpoint: WebhookEndpoint = {
    id: newEndpointId(),
    url,
    events,
    secret: newWebhookSecret(),
    active: true,
    createdAt: Date.now(),
    ...(description ? { description } : {}),
  };
  await db.ref(`apiWebhooks/${tenantId}/${endpoint.id}`).set(endpoint);
  return endpoint;
}

export async function updateEndpoint(
  tenantId: string,
  endpointId: string,
  patch: Partial<Pick<WebhookEndpoint, 'url' | 'events' | 'active' | 'description'>>
): Promise<void> {
  await db.ref(`apiWebhooks/${tenantId}/${endpointId}`).update(patch);
}

export async function deleteEndpoint(tenantId: string, endpointId: string): Promise<void> {
  await db.ref(`apiWebhooks/${tenantId}/${endpointId}`).set(null);
}

export function signPayload(secret: string, timestampSec: number, rawBody: string): string {
  return createHmac('sha256', secret).update(`${timestampSec}.${rawBody}`).digest('hex');
}

interface DeliveryResult {
  ok: boolean;
  status?: number;
  ms: number;
  error?: string;
}

async function attemptDelivery(
  endpoint: WebhookEndpoint,
  event: PublicEvent
): Promise<DeliveryResult> {
  const body = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Delivered-Webhooks/1.0',
        'dsms-signature': `t=${t},v1=${signPayload(endpoint.secret, t, body)}`,
        'dsms-event-id': event.id,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { ok: res.status >= 200 && res.status < 300, status: res.status, ms: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - started,
      error: err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'unreachable',
    };
  }
}

async function logDelivery(
  tenantId: string,
  endpointId: string,
  event: PublicEvent,
  result: DeliveryResult,
  attempt: number
): Promise<void> {
  await db.ref(`apiWebhookDeliveries/${tenantId}/${endpointId}`).push({
    eventId: event.id,
    type: event.type,
    ok: result.ok,
    status: result.status ?? null,
    error: result.error ?? null,
    ms: result.ms,
    attempt,
    at: Date.now(),
  });
}

function endpointWantsEvent(endpoint: WebhookEndpoint, type: string): boolean {
  return endpoint.events === '*' || endpoint.events.includes(type as ApiEventType);
}

/**
 * Deliver an event to every matching endpoint. Called inline from emitEvent —
 * a tenant with no endpoints costs one RTDB read and returns immediately; a
 * tenant whose endpoint is down costs at most DELIVERY_TIMEOUT_MS (their own
 * endpoint, their latency), after which the retry cron owns it. Never throws.
 */
export async function deliverEvent(tenantId: string, event: PublicEvent): Promise<void> {
  try {
    const endpoints = (await listEndpoints(tenantId)).filter(
      (e) => e.active && endpointWantsEvent(e, event.type)
    );
    if (endpoints.length === 0) return;
    await Promise.all(
      endpoints.map(async (endpoint) => {
        const result = await attemptDelivery(endpoint, event);
        await logDelivery(tenantId, endpoint.id, event, result, 1);
        if (!result.ok) {
          await db.ref('apiWebhookOutbox').push({
            tenantId,
            endpointId: endpoint.id,
            event,
            attempts: 1,
            nextAt: Date.now() + RETRY_DELAYS_MS[0],
          } satisfies RetryJob);
        }
      })
    );
  } catch (err) {
    console.error('[webhooks] deliverEvent failed:', err);
  }
}

/** Send a signed test.ping so a developer can verify their handler end to end. */
export async function sendTestEvent(
  tenantId: string,
  endpoint: WebhookEndpoint
): Promise<DeliveryResult> {
  const event = {
    id: newEventId(),
    object: 'event',
    type: 'test.ping',
    created_at: new Date().toISOString(),
    data: { message: 'If you can read this, your webhook endpoint works.' },
  } as unknown as PublicEvent;
  const result = await attemptDelivery(endpoint, event);
  await logDelivery(tenantId, endpoint.id, event, result, 1);
  return result;
}

/** Drain due retry jobs. Runs from the api-webhook-retry cron. */
export async function flushWebhookOutbox(): Promise<{
  sent: number;
  rescheduled: number;
  dropped: number;
  remaining: number;
}> {
  const now = Date.now();
  // Unordered fetch + in-code filter: an orderByChild query would need an
  // .indexOn rule on the shared RTDB, which isn't worth touching for a queue
  // that only holds currently-failing deliveries. Not-yet-due rows are simply
  // skipped and picked up on a later run.
  const snap = await db.ref('apiWebhookOutbox').limitToFirst(100).get();
  if (!snap.exists()) return { sent: 0, rescheduled: 0, dropped: 0, remaining: 0 };

  let sent = 0;
  let rescheduled = 0;
  let dropped = 0;
  const jobs: Array<{ key: string; job: RetryJob }> = [];
  snap.forEach((child) => {
    const job = child.val() as RetryJob;
    if (job.nextAt <= now) jobs.push({ key: child.key as string, job });
  });

  for (const { key, job } of jobs) {
    const endpoint = await getEndpoint(job.tenantId, job.endpointId);
    if (!endpoint || !endpoint.active) {
      // Endpoint deleted or paused since the failure — nothing to retry.
      await db.ref(`apiWebhookOutbox/${key}`).set(null);
      dropped++;
      continue;
    }
    const result = await attemptDelivery(endpoint, job.event);
    await logDelivery(job.tenantId, job.endpointId, job.event, result, job.attempts + 1);
    if (result.ok) {
      await db.ref(`apiWebhookOutbox/${key}`).set(null);
      sent++;
    } else if (job.attempts >= RETRY_DELAYS_MS.length) {
      await db.ref(`apiWebhookOutbox/${key}`).set(null);
      dropped++;
    } else {
      await db.ref(`apiWebhookOutbox/${key}`).update({
        attempts: job.attempts + 1,
        nextAt: Date.now() + RETRY_DELAYS_MS[Math.min(job.attempts, RETRY_DELAYS_MS.length - 1)],
      });
      rescheduled++;
    }
  }

  const remainingSnap = await db.ref('apiWebhookOutbox').limitToFirst(1).get();
  return { sent, rescheduled, dropped, remaining: remainingSnap.exists() ? 1 : 0 };
}
