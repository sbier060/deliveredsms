import { NextRequest } from 'next/server';
import { withApiKey } from '@/lib/api/auth';
import { apiError, apiJson } from '@/lib/api/response';
import { getVerification, toPublicVerification } from '@/lib/api/verify-store';
import type { ApiContext } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 15;

export const GET = withApiKey(
  async (_req: NextRequest, ctx: ApiContext, params: Record<string, string>) => {
    const id = params.id || '';
    if (!/^ver_[A-Za-z0-9]{16}$/.test(id)) {
      return apiError(404, 'verification_not_found', 'No verification found with that id.');
    }
    const record = await getVerification(ctx.tenantId, id);
    if (!record) {
      return apiError(404, 'verification_not_found', 'No verification found with that id.');
    }
    return apiJson({
      ...toPublicVerification(record),
      ...(record.blockedReason ? { blocked_reason: record.blockedReason } : {}),
      charged: Boolean(record.chargedAt),
    });
  }
);
