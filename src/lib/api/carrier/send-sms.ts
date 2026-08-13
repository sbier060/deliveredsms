/**
 * Live SMS send for API tenants - Inteliquent Message Broker, logic extracted
 * from cloud-functions/sendSMSSinch (which is NOT touched or called).
 *
 * Kept from the original pipeline: the moderateMessageSinch content check
 * (blocking, fail-open - calling the deployed function over HTTPS, not
 * modifying it) and the fire-and-forget spamMessageDetector call. Message
 * records live only in the rules-locked apiMessages store - API traffic never
 * writes the consumer webhooks/{number} node.
 */

const MESSAGE_BROKER_URL =
  'https://messagebroker.inteliquent.com/msgbroker/rest/publishMessages';
const MODERATE_URL =
  'https://us-central1-burner-app-39cd0.cloudfunctions.net/moderateMessageSinch';
const SPAM_DETECT_URL =
  'https://us-central1-burner-app-39cd0.cloudfunctions.net/spamMessageDetector';

/** 11-digit form ("1XXXXXXXXXX") the broker expects. */
function broker11(e164: string): string {
  return `1${e164.replace(/[^\d]/g, '').slice(-10)}`;
}

async function moderate(
  from: string,
  to: string,
  body: string
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(MODERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: body, from: broker11(from), to: broker11(to) }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { allowed: true }; // fail-open, matching the app pipeline
    const data = (await res.json()) as { allowed?: boolean; reason?: string };
    if (data.allowed === false) {
      return { allowed: false, reason: data.reason || 'content_policy' };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export class CarrierRejectedError extends Error {
  constructor(public httpStatus: number, public detail: string) {
    super(detail);
    this.name = 'CarrierRejectedError';
  }
}

export class SendBlockedError extends Error {}

export async function carrierSendSms(input: {
  from: string; // E.164
  to: string; // E.164
  body: string;
}): Promise<{ referenceId: string }> {
  const apiKey = process.env.MESSAGE_BROKER_API_KEY;
  if (!apiKey) throw new Error('MESSAGE_BROKER_API_KEY not configured');

  const verdict = await moderate(input.from, input.to, input.body);
  if (!verdict.allowed) {
    throw new SendBlockedError(
      'This message was blocked by our content policy.'
    );
  }

  const res = await fetch(MESSAGE_BROKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: broker11(input.from),
      text: input.body,
      to: [broker11(input.to)],
      mediaUrls: [],
    }),
  });
  const data = (await res.json().catch(() => null)) as {
    success?: boolean;
    result?: { referenceId?: string };
    error?: unknown;
    message?: unknown;
  } | null;
  if (!res.ok || !data || data.success !== true) {
    // Keep the broker's own words - this is the only failure reason we will
    // ever have until DLRs exist, and discarding it left every failed send as
    // an anonymous 502.
    const detail = [data?.error, data?.message]
      .filter((x): x is string => typeof x === 'string')
      .join('; ')
      .slice(0, 300);
    throw new CarrierRejectedError(res.status, detail || `Message Broker send failed (${res.status})`);
  }

  // Feed the spam graph, same as the consumer pipeline (fire-and-forget).
  fetch(SPAM_DETECT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneNumber: broker11(input.from),
      message: input.body,
      direction: 'outgoing',
    }),
  }).catch(() => {});

  return {
    referenceId:
      data.result?.referenceId || `api_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  };
}
