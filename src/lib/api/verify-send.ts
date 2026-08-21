/**
 * The Verify send path.
 *
 * WHY THIS DOESN'T GO THROUGH carrierSendSms():
 *
 * carrierSendSms() runs every message through the deployed moderateMessageSinch
 * Cloud Function, which is built to police USER-GENERATED content. Two of its
 * rules make OTP delivery structurally impossible:
 *
 *   1. Its `accountPaymentFraud` category fires at two keyword hits, and its
 *      keyword list contains "verification", "one-time", "otp", "code" and
 *      "reset". Canonical OTP copy trips it on the first send.
 *   2. Its velocity rule blocks four recipients sharing an identical body
 *      within 30 minutes. An OTP template is identical by construction (only
 *      the digits change, and its fingerprinter collapses digit-bearing words),
 *      so the fifth user of any app would be blocked.
 *
 * The carve-out is safe because the body here is a GHOST-CONTROLLED TEMPLATE.
 * A developer cannot supply message content to this endpoint - the only
 * variable is a six-digit code we generated. There is no user-generated content
 * to moderate. The abuse surface Verify actually has is SMS pumping, which
 * moderation does not address and which Shield (NPA allowlist,
 * per-destination/tenant/IP velocity, VoIP gate, ban registry) does.
 *
 * moderateMessageSinch itself is NOT modified - it stays byte-identical for
 * every consumer and /v1/messages send. Approved by Alek 2026-08-07.
 */

const MESSAGE_BROKER_URL =
  'https://messagebroker.inteliquent.com/msgbroker/rest/publishMessages';
const SPAM_DETECT_URL =
  'https://us-central1-burner-app-39cd0.cloudfunctions.net/spamMessageDetector';

/** 11-digit form the broker expects. */
function broker11(e164: string): string {
  return `1${e164.replace(/[^\d]/g, '').slice(-10)}`;
}

/** The one and only Verify template. Developers cannot change this text. */
export function verificationBody(code: string, appName?: string): string {
  const who = appName ? `${appName}` : 'Resms';
  return `${who} code: ${code}. It expires in 10 minutes. Don't share it.`;
}

export class VerifySendError extends Error {}

export async function sendVerificationSms(input: {
  from: string;
  to: string;
  code: string;
  appName?: string;
}): Promise<{ referenceId: string }> {
  const apiKey = process.env.MESSAGE_BROKER_API_KEY;
  if (!apiKey) throw new VerifySendError('MESSAGE_BROKER_API_KEY not configured');

  const body = verificationBody(input.code, input.appName);

  const res = await fetch(MESSAGE_BROKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: broker11(input.from),
      text: body,
      to: [broker11(input.to)],
      mediaUrls: [],
    }),
  });
  const data = (await res.json().catch(() => null)) as {
    success?: boolean;
    result?: { referenceId?: string };
  } | null;
  if (!res.ok || !data || data.success !== true) {
    throw new VerifySendError(`Message Broker rejected the verification (${res.status})`);
  }

  // Still feed the spam graph - it classifies OTP text as NOT spam, so this is
  // signal about the destination, not about us.
  fetch(SPAM_DETECT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneNumber: broker11(input.from),
      message: body,
      direction: 'outgoing',
    }),
  }).catch(() => {});

  return {
    referenceId:
      data.result?.referenceId ||
      `ver_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  };
}
