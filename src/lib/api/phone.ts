/**
 * US/Canada phone normalization for the public API.
 * Accepts "+1XXXXXXXXXX", "1XXXXXXXXXX", or "XXXXXXXXXX" (with optional
 * punctuation) and returns E.164 "+1XXXXXXXXXX", or null if invalid.
 */
export function normalizeE164(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/** Last 10 digits — the key format used across RTDB (phoneNumberOwners etc.). */
export function digits10(e164: string): string {
  return e164.replace(/[^\d]/g, '').slice(-10);
}
