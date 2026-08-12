import { NextRequest } from 'next/server';
import { withApiKey } from '@/lib/api/auth';
import { apiError, apiJson } from '@/lib/api/response';
import { getMessage, toPublicMessage } from '@/lib/api/messages';
import type { ApiContext } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 15;

export const GET = withApiKey(
  async (_req: NextRequest, ctx: ApiContext, params: Record<string, string>) => {
    const id = params.id || '';
    if (!/^msg_[A-Za-z0-9]{16}$/.test(id)) {
      return apiError(404, 'not_found', 'No message found with that id.');
    }
    const message = await getMessage(ctx.tenantId, id);
    if (!message) return apiError(404, 'not_found', 'No message found with that id.');
    return apiJson(toPublicMessage(message));
  }
);
