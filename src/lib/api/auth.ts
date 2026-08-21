import { NextRequest, NextResponse } from 'next/server';
import { checkBanned } from '@/lib/banned';
import { getClientIp } from '@/lib/ip';
import { getKeyBySecret, touchKey } from './keys';
import { getTenant, markFirstCall } from './tenants';
import { takeSlot } from './rate-limit';
import { incrementUsage } from './usage';
import { apiError } from './response';
import type { ApiContext } from './types';

// Accepts all three prefixes: resms_sk_ is minted today; dsms_sk_ (Delivered
// era) and ghost_sk_ (Ghost era) keys issued before the rebrands keep working
// forever.
const KEY_SHAPE = /^Bearer\s+((?:resms_sk_|dsms_sk_|ghost_sk_)(?:test|live)_[A-Za-z0-9]{20,})$/;

export interface WithApiKeyOptions {
  /** Reject test keys with 403 test-vs-live errors. */
  requireLive?: boolean;
  /** Reject live keys (sandbox-only endpoints like /v1/test/inbound). */
  testOnly?: boolean;
  /** Per-key rate limit override; default 60 requests / 60s. */
  rateLimit?: { limit: number; windowSec: number };
}

type V1Handler = (
  req: NextRequest,
  ctx: ApiContext,
  routeParams: Record<string, string>
) => Promise<Response>;

/**
 * Auth wrapper for every /api/v1 route. FAILS CLOSED at every step - an
 * internal error is a 401/500, never a pass-through. (Deliberate departure
 * from the repo's consumer-side fail-open house style.)
 */
export function withApiKey(handler: V1Handler, opts: WithApiKeyOptions = {}) {
  return async (
    req: NextRequest,
    routeCtx?: { params?: Record<string, string> }
  ): Promise<Response> => {
    try {
      const match = (req.headers.get('authorization') || '').match(KEY_SHAPE);
      if (!match) {
        return apiError(
          401,
          'invalid_api_key',
          'Missing or malformed API key. Pass it as: Authorization: Bearer resms_sk_...'
        );
      }

      const found = await getKeyBySecret(match[1]);
      if (!found || found.record.revokedAt) {
        return apiError(401, 'invalid_api_key', 'Invalid or revoked API key.');
      }

      const tenant = await getTenant(found.record.tenantId);
      if (!tenant) {
        return apiError(401, 'invalid_api_key', 'Invalid or revoked API key.');
      }
      if (tenant.status === 'suspended') {
        return apiError(403, 'tenant_suspended', 'This account is suspended.');
      }

      const mode = found.record.mode;
      if (mode === 'live' && tenant.status !== 'live') {
        return apiError(
          403,
          'live_access_required',
          'Live access has not been enabled for this account yet.'
        );
      }
      if (opts.requireLive && mode !== 'live') {
        return apiError(
          403,
          'live_access_required',
          'This endpoint requires a live key (resms_sk_live_...).'
        );
      }
      if (opts.testOnly && mode !== 'test') {
        return apiError(
          403,
          'test_mode_only',
          'This endpoint only works with test keys (resms_sk_test_...).'
        );
      }

      const banned = await checkBanned(
        tenant.uid,
        tenant.email,
        getClientIp(req)
      );
      if (banned.banned) {
        return apiError(403, 'forbidden', 'This account is not permitted to use the API.');
      }

      const rl = opts.rateLimit ?? { limit: 60, windowSec: 60 };
      const slot = await takeSlot(found.hash, rl.limit, rl.windowSec * 1000);
      if (!slot.allowed) {
        return apiError(
          429,
          'rate_limited',
          `Rate limit exceeded (${rl.limit} requests per ${rl.windowSec}s).`,
          undefined,
          { 'Retry-After': String(slot.retryAfterSec) }
        );
      }

      // Observability + the console's "first call received" moment.
      touchKey(found.hash);
      incrementUsage(tenant.id, 'api_requests');
      markFirstCall(tenant.id);

      const ctx: ApiContext = {
        tenantId: tenant.id,
        tenant,
        uid: tenant.uid,
        keyHash: found.hash,
        keyId: found.record.keyId,
        mode,
      };
      return await handler(req, ctx, routeCtx?.params || {});
    } catch (error) {
      console.error('[api/v1] unhandled error:', error);
      return apiError(500, 'internal_error', 'Something went wrong on our side.');
    }
  };
}

/** Standard 405 for unsupported methods on a route. */
export function methodNotAllowed(): NextResponse {
  return apiError(404, 'not_found', 'Unknown method for this endpoint.');
}
