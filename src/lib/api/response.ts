import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'invalid_api_key'
  | 'tenant_suspended'
  | 'live_access_required'
  | 'test_mode_only'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'recipient_not_verified'
  | 'verification_blocked'
  | 'verification_not_found'
  | 'idempotency_conflict'
  | 'carrier_error'
  | 'mms_not_enabled'
  | 'internal_error';

/**
 * Stable v1 error envelope: { "error": { "code", "message", ...extra } }.
 * Unlike the rest of this repo, the public API fails CLOSED — callers of this
 * helper should prefer erroring over passing a request through on uncertainty.
 */
export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra?: Record<string, unknown>,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(extra || {}) } },
    { status, headers }
  );
}

export function apiJson(
  body: unknown,
  status = 200,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json(body, { status, headers });
}

export function apiList(
  data: unknown[],
  hasMore: boolean,
  nextCursor: string | null
): NextResponse {
  return NextResponse.json({ data, has_more: hasMore, next_cursor: nextCursor });
}
