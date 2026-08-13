import { NextRequest } from 'next/server';
import { withApiKey } from '@/lib/api/auth';
import { apiError, apiJson } from '@/lib/api/response';
import { normalizeE164 } from '@/lib/api/phone';
import { activeNumbers } from '@/lib/api/tenants';
import { storeMessage, toPublicMessage } from '@/lib/api/messages';
import { processInbound } from '@/lib/api/inbound';
import type { ApiContext } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Sandbox-only: simulate an inbound SMS to one of your test numbers. Runs
 * through the real message store + event pipeline so webhook integrations can
 * be tested end-to-end without a carrier.
 */
export const POST = withApiKey(
  async (req: NextRequest, ctx: ApiContext) => {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return apiError(400, 'invalid_request', 'Request body must be JSON.');
    }
    const { to, from, body } = (raw || {}) as Record<string, unknown>;

    const toE164 = normalizeE164(to);
    const fromE164 = normalizeE164(from);
    if (!toE164 || !activeNumbers(ctx.tenant).includes(toE164)) {
      return apiError(400, 'invalid_request', '`to` must be one of your sandbox numbers.', { param: 'to' });
    }
    if (!fromE164) {
      return apiError(400, 'invalid_request', '`from` must be a valid US/Canada number.', { param: 'from' });
    }
    if (typeof body !== 'string' || body.length === 0 || body.length > 1600) {
      return apiError(400, 'invalid_request', '`body` is required (max 1600 chars).', { param: 'body' });
    }

    const stored = await storeMessage(ctx.tenantId, {
      to: toE164,
      from: fromE164,
      body,
      direction: 'inbound',
      status: 'received',
      test: true,
    });
    // Same processor the live carrier ingest uses, so STOP/START/HELP behave
    // identically in sandbox and a developer can actually rehearse opt-out.
    await processInbound({
      tenantId: ctx.tenantId,
      to: toE164,
      from: fromE164,
      body,
      test: true,
      messageId: stored.id,
    });

    return apiJson(toPublicMessage(stored), 201);
  },
  { testOnly: true }
);
