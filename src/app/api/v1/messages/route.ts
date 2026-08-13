import { NextRequest } from 'next/server';
import { withApiKey } from '@/lib/api/auth';
import { apiError, apiJson, apiList } from '@/lib/api/response';
import { normalizeE164, digits10 } from '@/lib/api/phone';
import { activeNumbers } from '@/lib/api/tenants';
import { listMessages } from '@/lib/api/messages';
import { sendOutbound } from '@/lib/api/send-core';
import { emitEvent } from '@/lib/api/events';
import { checkIdempotency, saveIdempotentResponse } from '@/lib/api/idempotency';
import type { ApiContext } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

export const POST = withApiKey(async (req: NextRequest, ctx: ApiContext) => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, 'invalid_request', 'Request body must be JSON.');
  }
  const { to, from, body, media } = (raw || {}) as Record<string, unknown>;

  // MMS groundwork: the field is part of the contract now, but every number is
  // provisioned SMS-only at the carrier until the SMSMMS feature flip lands.
  // An honest 400 beats accepting media and silently dropping it.
  if (media !== undefined) {
    return apiError(
      400,
      'mms_not_enabled',
      'MMS is not enabled yet. Send text-only for now; media will be supported once numbers are provisioned for MMS.',
      { param: 'media' }
    );
  }

  const toE164 = normalizeE164(to);
  const fromE164 = normalizeE164(from);
  if (!toE164) {
    return apiError(400, 'invalid_request', '`to` must be a valid US/Canada number in E.164 format.', { param: 'to' });
  }
  if (!fromE164) {
    return apiError(400, 'invalid_request', '`from` must be a valid US/Canada number in E.164 format.', { param: 'from' });
  }
  if (typeof body !== 'string' || body.length === 0) {
    return apiError(400, 'invalid_request', '`body` is required.', { param: 'body' });
  }
  if (body.length > 1600) {
    return apiError(400, 'invalid_request', '`body` must be 1600 characters or fewer.', { param: 'body' });
  }
  if (!activeNumbers(ctx.tenant).includes(fromE164)) {
    return apiError(
      403,
      'forbidden',
      `\`from\` must be a number owned by your account. Your numbers: ${activeNumbers(ctx.tenant).join(', ') || '(none)'}.`,
      { param: 'from' }
    );
  }

  // Idempotency
  const idemKey = req.headers.get('idempotency-key');
  if (idemKey) {
    const check = await checkIdempotency(ctx.tenantId, idemKey, { to: toE164, from: fromE164, body });
    if (check.kind === 'replay') return apiJson(check.body, check.status);
    if (check.kind === 'conflict') {
      return apiError(409, 'idempotency_conflict', 'This Idempotency-Key was already used with a different request (or the original request is still in flight).');
    }
  }

  const result = await sendOutbound(ctx.tenantId, ctx.tenant, ctx.mode, {
    to: toE164,
    from: fromE164,
    body,
    sentBy: { name: 'API' },
  });

  if (!result.ok) {
    return apiError(
      result.status,
      result.code as Parameters<typeof apiError>[1],
      result.message,
      result.param ? { param: result.param } : undefined,
      result.headers
    );
  }

  if (idemKey) saveIdempotentResponse(ctx.tenantId, idemKey, 201, result.message);
  return apiJson(result.message, 201, result.headers);
});

export const GET = withApiKey(async (req: NextRequest, ctx: ApiContext) => {
  const url = req.nextUrl;
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25));
  const cursor = url.searchParams.get('cursor');
  const numberParam = url.searchParams.get('number');
  const number = numberParam ? normalizeE164(numberParam) : null;
  if (numberParam && !number) {
    return apiError(400, 'invalid_request', '`number` must be a valid US/Canada number.', { param: 'number' });
  }
  const page = await listMessages(ctx.tenantId, { limit, cursor, number });
  return apiList(page.data, page.hasMore, page.nextCursor);
});
