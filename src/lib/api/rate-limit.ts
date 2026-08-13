import { db } from '@/lib/firebase-admin';

/**
 * Fixed-window rate limiter on RTDB transactions (house style - see
 * src/app/api/signin-methods/route.ts and removePhoneNumberExpo). Unlike
 * those, this FAILS CLOSED: a transaction error counts as "not allowed",
 * because on the public API the caller is the abuse vector.
 */
export async function takeSlot(
  bucket: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; retryAfterSec: number }> {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const safeBucket = bucket.replace(/[.#$/\[\]]/g, '_');
  const ref = db.ref(`apiRateLimits/${safeBucket}/${windowStart}`);
  try {
    const result = await ref.transaction((current) => {
      const count = (current as number | null) || 0;
      if (count >= limit) return; // abort - over limit
      return count + 1;
    });
    const count = (result.snapshot?.val() as number | null) || 0;
    const retryAfterSec = Math.ceil((windowStart + windowMs - Date.now()) / 1000);
    if (!result.committed) {
      return { allowed: false, remaining: 0, retryAfterSec };
    }
    return {
      allowed: true,
      remaining: Math.max(0, limit - count),
      retryAfterSec,
    };
  } catch (error) {
    console.error('[api/rate-limit] transaction failed (failing closed):', error);
    return { allowed: false, remaining: 0, retryAfterSec: 30 };
  }
}
