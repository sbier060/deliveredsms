import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/console-auth';
import { getTenantIdByUid, getTenant } from '@/lib/api/tenants';
import { normalizeE164 } from '@/lib/api/phone';
import { takeSlot } from '@/lib/api/rate-limit';
import { runShield } from '@/lib/api/verify-shield';
import { getClientIp } from '@/lib/ip';
import { resolveVerifySender, NoSenderAvailableError } from '@/lib/api/verify-sender';
import { sendVerificationSms, VerifySendError } from '@/lib/api/verify-send';
import {
  createVerification,
  generateCode,
  checkCode,
  getActiveVerification,
  resendWaitMs,
  MAX_ATTEMPTS,
} from '@/lib/api/verify-store';
import {
  addVerifiedRecipient,
  removeVerifiedRecipient,
  canAddVerifiedRecipient,
} from '@/lib/api/verified-recipients';
import { isUsOrCanadaNpa } from '@/lib/api/nanp';
import { FREE_TIER } from '@/lib/api/pricing';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Free-tier recipient verification for the console.
 *
 * This runs on GHOST VERIFY — our own OTP primitive — not Twilio Verify.
 * Using Twilio here would mean paying ~$0.05 to a competitor for the exact
 * thing our product does for ~$0.002, in the console of the product that
 * replaces it. It also means our own onboarding exercises the same code path
 * developers depend on, so a regression shows up for us first.
 */

/** Send a verification code to a candidate recipient. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantIdByUid(user.uid);
  const tenant = tenantId ? await getTenant(tenantId) : null;
  if (!tenantId || !tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { phone?: string; code?: string };
  const e164 = normalizeE164(body.phone);
  if (!e164) {
    return NextResponse.json({ error: 'Enter a valid US or Canada number.' }, { status: 400 });
  }

  // ── Confirm step ──────────────────────────────────────────────────────────
  if (body.code) {
    const outcome = await checkCode(tenantId, e164, String(body.code).trim());
    if (outcome.result === 'not_found') {
      return NextResponse.json(
        { error: 'That code has expired. Send a new one.' },
        { status: 400 }
      );
    }
    if (outcome.result !== 'approved') {
      const left = Math.max(0, MAX_ATTEMPTS - outcome.record.attempts);
      return NextResponse.json(
        {
          error:
            outcome.result === 'max_attempts'
              ? 'Too many attempts. Send a new code.'
              : `That code is not right.${left ? ` ${left} tries left.` : ''}`,
        },
        { status: 400 }
      );
    }
    await addVerifiedRecipient(tenantId, e164);
    return NextResponse.json({ ok: true, verified: e164 });
  }

  // ── Send step ─────────────────────────────────────────────────────────────
  if (!canAddVerifiedRecipient(tenant)) {
    return NextResponse.json(
      {
        error: `You can verify up to ${FREE_TIER.maxVerifiedRecipients} numbers. Remove one first, or add a payment method to text anyone.`,
      },
      { status: 400 }
    );
  }
  if (!isUsOrCanadaNpa(e164)) {
    return NextResponse.json(
      { error: 'We can only verify US and Canada numbers right now.' },
      { status: 400 }
    );
  }

  const existing = await getActiveVerification(tenantId, e164);
  const wait = resendWaitMs(existing);
  if (wait > 0) {
    return NextResponse.json(
      { error: `A code was just sent. Try again in ${Math.ceil(wait / 1000)}s.` },
      { status: 429 }
    );
  }

  // Sending real SMS costs real money, so cap this hard per tenant.
  const slot = await takeSlot(`verify_recipient_${tenantId}`, 5, 60 * 60 * 1000);
  if (!slot.allowed) {
    return NextResponse.json(
      { error: 'Too many verification attempts. Try again in an hour.' },
      { status: 429 }
    );
  }

  // Shield closes the cross-tenant hole the per-tenant cap can't: a farm of
  // free accounts hammering ONE victim number shares Shield's per-destination
  // and per-IP counters with the public /v1/verify path.
  const verdict = await runShield({ tenant, phone: e164, ip: getClientIp(req) });
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: verdict.message || 'This verification was blocked.' },
      { status: 429, headers: verdict.retryAfterSec ? { 'Retry-After': String(verdict.retryAfterSec) } : undefined }
    );
  }

  let from: string;
  try {
    from = await resolveVerifySender({
      tenant,
      destination: e164,
      mode: 'live',
      requestedFrom: null,
    });
  } catch (error) {
    if (error instanceof NoSenderAvailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  const code = generateCode();
  await createVerification({ tenantId, phone: e164, code, test: false });
  try {
    await sendVerificationSms({ from, to: e164, code, appName: 'OpenSMS' });
  } catch (error) {
    if (error instanceof VerifySendError) {
      console.error('[developers/verify-recipient] send failed:', error.message);
    }
    return NextResponse.json(
      { error: 'Could not send the code right now. Try again shortly.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, sent: true });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantIdByUid(user.uid);
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 404 });

  const e164 = normalizeE164(req.nextUrl.searchParams.get('phone'));
  if (!e164) return NextResponse.json({ error: 'Invalid number' }, { status: 400 });
  await removeVerifiedRecipient(tenantId, e164);
  return NextResponse.json({ ok: true });
}
