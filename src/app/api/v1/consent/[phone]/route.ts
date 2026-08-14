import { NextRequest } from 'next/server';
import { withApiKey } from '@/lib/api/auth';
import { apiJson, apiError } from '@/lib/api/response';
import { normalizeE164 } from '@/lib/api/phone';
import {
  consentStatus,
  consentHistory,
  recordOptOut,
  recordOptIn,
} from '@/lib/api/opt-out';
import { emitEvent } from '@/lib/api/events';
import type { ApiContext } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 15;

function parsePhone(params: Record<string, string>) {
  return normalizeE164(decodeURIComponent(params.phone || ''));
}

/** Current consent state + append-only history for one number. */
export const GET = withApiKey(
  async (_req: NextRequest, ctx: ApiContext, params: Record<string, string>) => {
    const e164 = parsePhone(params);
    if (!e164) {
      return apiError(400, 'invalid_request', 'Provide a valid US/Canada number, e.g. /v1/consent/+14155550132.', { param: 'phone' });
    }
    const [status, history] = await Promise.all([
      consentStatus(ctx.tenantId, e164),
      consentHistory(ctx.tenantId, e164, 50),
    ]);
    return apiJson({
      object: 'consent',
      phone: e164,
      status,
      history: history.map((h) => ({
        at: new Date(h.at).toISOString(),
        type: h.type,
        via: h.via,
        ...(h.method ? { method: h.method } : {}),
        ...(h.keyword ? { detected: h.keyword } : {}),
        ...(h.confidence !== undefined ? { confidence: h.confidence } : {}),
        ...(h.note ? { note: h.note } : {}),
      })),
    });
  }
);

/**
 * Set consent state from your own system (CRM sync, web form, support tool).
 * Recorded in the ledger with via "api_set" and emitted as a webhook event.
 */
export const POST = withApiKey(
  async (req: NextRequest, ctx: ApiContext, params: Record<string, string>) => {
    const e164 = parsePhone(params);
    if (!e164) {
      return apiError(400, 'invalid_request', 'Provide a valid US/Canada number in the path.', { param: 'phone' });
    }
    let body: { status?: unknown; note?: unknown };
    try {
      body = await req.json();
    } catch {
      return apiError(400, 'invalid_request', 'Body must be JSON.');
    }
    const status = body.status;
    if (status !== 'opted_out' && status !== 'opted_in') {
      return apiError(400, 'invalid_request', '`status` must be "opted_out" or "opted_in".', { param: 'status' });
    }
    const note = typeof body.note === 'string' ? body.note.slice(0, 200) : undefined;

    if (status === 'opted_out') {
      await recordOptOut(ctx.tenantId, e164, 'api_set', undefined, { method: 'api', note });
      await emitEvent(ctx.tenantId, 'message.opted_out', { phone: e164, method: 'api' });
    } else {
      await recordOptIn(ctx.tenantId, e164, 'api_set', { method: 'api', note });
      await emitEvent(ctx.tenantId, 'message.opted_in', { phone: e164, method: 'api' });
    }
    return apiJson({ object: 'consent', phone: e164, status });
  }
);
