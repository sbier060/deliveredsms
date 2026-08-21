import { randomBytes, createHash } from 'crypto';

const ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Uniform random base62 string (rejection sampling, crypto-strong). */
export function randomBase62(length: number): string {
  let out = '';
  while (out.length < length) {
    const bytes = randomBytes(length * 2);
    for (let i = 0; i < bytes.length && out.length < length; i++) {
      // Reject bytes >= 248 to keep the modulo unbiased (248 = 4 * 62).
      if (bytes[i] < 248) out += ALPHABET[bytes[i] % 62];
    }
  }
  return out;
}

export const newTenantId = () => `tn_${randomBase62(12)}`;
export const newMessageId = () => `msg_${randomBase62(16)}`;
export const newEventId = () => `evt_${randomBase62(16)}`;
export const newKeyId = () => `key_${randomBase62(12)}`;
export const newEndpointId = () => `we_${randomBase62(12)}`;

export function newKeySecret(mode: 'test' | 'live'): string {
  return `resms_sk_${mode}_${randomBase62(32)}`;
}

export const newWebhookSecret = () => `whsec_${randomBase62(32)}`;

export function sha256hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
