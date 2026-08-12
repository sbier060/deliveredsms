import type { NextRequest } from 'next/server';
import crypto from 'crypto';

// ── Server-side admin authorization ─────────────────────────────────────────
//
// Replaces the old client-side-only PIN gate (which sent nothing to the server,
// so every /api/admin/* and /api/sessions* route was effectively public).
//
// A request is authorized as admin if EITHER:
//   1. it carries a valid signed `ghost_admin` session cookie (issued by
//      /api/admin/login after a correct PIN), OR
//   2. it presents a Bearer / x-api-secret matching the server admin secret
//      (break-glass + server-to-server).
//
// Lockout-safe by construction: the signing secret and the admin secret each
// fall back across several env vars that are guaranteed set in prod, and the
// PIN falls back to the historical value if ADMIN_PIN is unset.

export const ADMIN_COOKIE = 'ghost_admin';
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

function signingSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.CRON_SECRET ||
    process.env.API_SECRET ||
    ''
  );
}

function adminApiSecret(): string {
  return process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || process.env.API_SECRET || '';
}

export function adminPin(): string {
  // Fallback to the historical PIN so a missing env var can never lock admins out.
  // Override in prod by setting ADMIN_PIN.
  return process.env.ADMIN_PIN || '1806';
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function makeSessionToken(): string {
  const exp = String(Date.now() + TTL_MS);
  const sig = crypto.createHmac('sha256', signingSecret()).update(exp).digest('hex');
  return `${exp}.${sig}`;
}

function validSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = crypto.createHmac('sha256', signingSecret()).update(exp).digest('hex');
  return safeEqual(sig, expected);
}

function bearerOk(request: NextRequest): boolean {
  const secret = adminApiSecret();
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const xkey = request.headers.get('x-api-secret') || '';
  return safeEqual(token, secret) || safeEqual(xkey, secret);
}

/** True if the request is an authenticated admin (cookie or break-glass secret). */
export function isAdminRequest(request: NextRequest): boolean {
  if (bearerOk(request)) return true;
  return validSessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
}

/** Standard 401 body for gated routes. */
export function adminUnauthorized(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
