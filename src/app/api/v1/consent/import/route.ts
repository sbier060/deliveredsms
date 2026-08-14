import { NextRequest } from 'next/server';
import { withApiKey } from '@/lib/api/auth';
import { apiJson, apiError } from '@/lib/api/response';
import { normalizeE164 } from '@/lib/api/phone';
import { recordOptOut } from '@/lib/api/opt-out';
import type { ApiContext } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH_LIMIT = 500;

/**
 * Bulk-import a suppression list (e.g. from Twilio or a CRM). Numbers are
 * recorded as opted out with via "import". Per-number webhook events are NOT
 * emitted for imports; the ledger records each one.
 */
export const POST = withApiKey(async (req: NextRequest, ctx: ApiContext) => {
  let body: { phone_numbers?: unknown };
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_request', 'Body must be JSON.');
  }
  const list = body.phone_numbers;
  if (!Array.isArray(list) || list.length === 0) {
    return apiError(400, 'invalid_request', '`phone_numbers` must be a non-empty array.', { param: 'phone_numbers' });
  }
  if (list.length > BATCH_LIMIT) {
    return apiError(400, 'invalid_request', `Import at most ${BATCH_LIMIT} numbers per request.`, { param: 'phone_numbers' });
  }

  let imported = 0;
  const skipped: Array<{ value: string; reason: string }> = [];
  for (const raw of list) {
    const value = typeof raw === 'string' ? raw : String(raw);
    const e164 = normalizeE164(value);
    if (!e164) {
      skipped.push({ value: value.slice(0, 30), reason: 'not a valid US/Canada number' });
      continue;
    }
    await recordOptOut(ctx.tenantId, e164, 'import', undefined, { method: 'import' });
    imported += 1;
  }
  return apiJson({ object: 'consent_import', imported, skipped });
});
