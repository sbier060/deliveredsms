import { randomBase62 } from './ids';

/**
 * Sandbox semantics. Test keys never touch carrier, Twilio, or OpenAI paths -
 * everything here is simulated in-process.
 */

/** All sandbox numbers live in the reserved +1 500-555 range (never routable). */
export const SANDBOX_NUMBER_PREFIX = '+1500555';

/** Magic destination numbers with fixed behaviors (documented in /docs/sandbox). */
export const MAGIC_NUMBERS = {
  /** Message stays "queued" forever; no delivery event. */
  QUEUED_FOREVER: '+15005550001',
  /** Message fails; a message.failed event is emitted. */
  FAIL: '+15005550002',
  /** Canonical happy path (any other number behaves the same). */
  DELIVERED: '+15005550006',
  /**
   * Verify only: always returns the resend-cooldown 429. Sandbox has no real
   * cooldown (so you can iterate), so this is how you test the countdown path.
   */
  VERIFY_COOLDOWN: '+15005550003',
} as const;

export function isSandboxNumber(e164: string): boolean {
  return e164.startsWith(SANDBOX_NUMBER_PREFIX);
}

/** Mint a random sandbox number, e.g. +15005551234. */
export function mintTestNumber(): string {
  let digits = '';
  while (digits.length < 4) {
    const d = randomBase62(8).replace(/[^\d]/g, '');
    digits = (digits + d).slice(0, 4);
  }
  return `${SANDBOX_NUMBER_PREFIX}${digits}`;
}

/** Deterministic fake inventory for GET /v1/numbers/available in test mode. */
export function sandboxAvailableNumbers(areaCode: string): Array<{
  phone_number: string;
  locality: string;
  region: string;
}> {
  const seeds = ['0110', '0132', '0154', '0176', '0198'];
  return seeds.map((s) => ({
    phone_number: `${SANDBOX_NUMBER_PREFIX}${s}`,
    locality: 'Test City',
    region: areaCode === '415' ? 'CA' : 'US',
  }));
}

/** Canned lookup fixtures for test keys (real lookups are live-mode only). */
export function sandboxLookupFixture(e164: string): {
  phone_number: string;
  valid: boolean;
  line_type: string;
  carrier: { name: string; type: string };
  caller_name: string | null;
} {
  const last = e164[e164.length - 1];
  const mobile = Number(last) % 2 === 0;
  return {
    phone_number: e164,
    valid: true,
    line_type: mobile ? 'mobile' : 'landline',
    carrier: {
      name: mobile ? 'Sandbox Wireless' : 'Sandbox Telecom',
      type: mobile ? 'mobile' : 'landline',
    },
    caller_name: null,
  };
}
