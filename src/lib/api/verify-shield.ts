import { takeSlot } from './rate-limit';
import { digits10 } from './phone';
import { isUsOrCanadaNpa } from './nanp';
import { lookupPhone } from './lookup';
import type { ApiTenant } from './types';

/**
 * Shield — SMS-pumping defense for Verify.
 *
 * Pumping works by farming revenue-share on expensive destinations, so the
 * controls run cheapest-first: geography, then velocity (three axes), then the
 * one paid check (line type). Everything a developer is charged for happens
 * after these pass, so a blocked attempt costs them nothing.
 */

export type ShieldReason =
  | 'unsupported_region'
  | 'destination_cooldown'
  | 'destination_velocity'
  | 'tenant_velocity'
  | 'ip_velocity'
  | 'voip_not_supported';

export interface ShieldVerdict {
  allowed: boolean;
  reason?: ShieldReason;
  message?: string;
  retryAfterSec?: number;
}

const ALLOW: ShieldVerdict = { allowed: true };

function block(
  reason: ShieldReason,
  message: string,
  retryAfterSec?: number
): ShieldVerdict {
  return { allowed: false, reason, message, retryAfterSec };
}

export async function runShield(input: {
  tenant: ApiTenant;
  phone: string;
  ip: string;
}): Promise<ShieldVerdict> {
  const { tenant, phone, ip } = input;
  const dest = digits10(phone);

  // 1. Geography. +1 is not "US and Canada" — Caribbean NANP is the classic
  //    pumping destination and looks domestic to every other validator.
  const allowedNpas = tenant.verifyAllowedNpas;
  const npaOk = allowedNpas
    ? allowedNpas.includes(dest.slice(0, 3))
    : isUsOrCanadaNpa(phone);
  if (!npaOk) {
    return block(
      'unsupported_region',
      'Verify currently supports US and Canada numbers only. Ask us if you need another region enabled.'
    );
  }

  // 2. Per-destination: one code a minute, and hard caps beyond that.
  const cooldown = await takeSlot(`verify_dest_min_${dest}`, 1, 60_000);
  if (!cooldown.allowed) {
    return block(
      'destination_cooldown',
      'A code was just sent to this number. Wait a minute before requesting another.',
      cooldown.retryAfterSec
    );
  }
  const destHour = await takeSlot(`verify_dest_hr_${dest}`, 5, 60 * 60_000);
  if (!destHour.allowed) {
    return block(
      'destination_velocity',
      'Too many verification codes sent to this number recently.',
      destHour.retryAfterSec
    );
  }
  const destDay = await takeSlot(`verify_dest_day_${dest}`, 10, 24 * 60 * 60_000);
  if (!destDay.allowed) {
    return block(
      'destination_velocity',
      'This number has reached its daily verification limit.',
      destDay.retryAfterSec
    );
  }

  // 3. Per-tenant burst ceiling (separate from the billing quota).
  const tenantHour = await takeSlot(`verify_tenant_${tenant.id}`, 300, 60 * 60_000);
  if (!tenantHour.allowed) {
    return block(
      'tenant_velocity',
      'Verification rate limit reached for this account. Contact us to raise it.',
      tenantHour.retryAfterSec
    );
  }

  // 4. Per-IP — catches a single attacker spraying many destinations.
  if (ip && ip !== 'unknown') {
    const ipHour = await takeSlot(`verify_ip_${ip}`, 20, 60 * 60_000);
    if (!ipHour.allowed) {
      return block(
        'ip_velocity',
        'Too many verification requests from this source.',
        ipHour.retryAfterSec
      );
    }
  }

  // 5. Line type. The only control that can cost money, so it runs last, and
  //    it is nearly free in practice — lookupPhone caches 24h globally.
  //    FAILS OPEN: a Twilio outage must not take Verify down; the four
  //    controls above still applied.
  try {
    const lookup = await lookupPhone(phone);
    if (lookup && lookup.valid === false) {
      return block('unsupported_region', 'That number is not a valid phone number.');
    }
    if (lookup && lookup.line_type === 'voip') {
      return block(
        'voip_not_supported',
        'Verify does not send codes to VoIP numbers. Use a mobile number.'
      );
    }
  } catch {
    // fail open
  }

  return ALLOW;
}
