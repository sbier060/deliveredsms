import { NextRequest } from 'next/server';
import { withApiKey } from '@/lib/api/auth';
import { apiError, apiList } from '@/lib/api/response';
import { sandboxAvailableNumbers } from '@/lib/api/sandbox';
import { carrierSearchNumbers } from '@/lib/api/carrier/inteliquent';
import type { ApiContext } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

export const GET = withApiKey(async (req: NextRequest, ctx: ApiContext) => {
  const areaCode = req.nextUrl.searchParams.get('area_code') || '415';
  if (!/^\d{3}$/.test(areaCode)) {
    return apiError(400, 'invalid_request', '`area_code` must be 3 digits.', { param: 'area_code' });
  }

  if (ctx.mode === 'live') {
    try {
      const numbers = await carrierSearchNumbers(areaCode, 5);
      return apiList(
        numbers.map((n) => ({ object: 'available_number', ...n })),
        false,
        null
      );
    } catch (error) {
      console.error('[v1/numbers/available] carrier search failed:', error);
      return apiError(502, 'carrier_error', 'Number inventory is unavailable right now. Try again shortly.');
    }
  }

  return apiList(
    sandboxAvailableNumbers(areaCode).map((n) => ({ object: 'available_number', ...n })),
    false,
    null
  );
});
