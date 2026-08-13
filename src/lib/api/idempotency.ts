import { db } from '@/lib/firebase-admin';
import { sha256hex } from './ids';

/**
 * Idempotency-Key support (POST /v1/messages). Records live 24h and are swept
 * by the api-maintenance cron.
 */

interface IdempotencyRecord {
  payloadHash: string;
  responseBody?: string; // JSON string of the original response
  responseStatus?: number;
  createdAt: number;
}

export type IdempotencyCheck =
  | { kind: 'new' }
  | { kind: 'replay'; status: number; body: unknown }
  | { kind: 'conflict' };

export async function checkIdempotency(
  tenantId: string,
  idemKey: string,
  payload: unknown
): Promise<IdempotencyCheck> {
  const payloadHash = sha256hex(JSON.stringify(payload));
  const ref = db.ref(`apiIdempotency/${tenantId}/${sha256hex(idemKey)}`);
  const result = await ref.transaction((current) => {
    if (current === null) {
      const record: IdempotencyRecord = { payloadHash, createdAt: Date.now() };
      return record;
    }
    return; // abort - record exists
  });
  if (result.committed) return { kind: 'new' };

  const existing = result.snapshot?.val() as IdempotencyRecord | null;
  if (!existing || existing.payloadHash !== payloadHash) return { kind: 'conflict' };
  if (!existing.responseBody) return { kind: 'conflict' }; // original still in flight
  return {
    kind: 'replay',
    status: existing.responseStatus || 200,
    body: JSON.parse(existing.responseBody),
  };
}

export function saveIdempotentResponse(
  tenantId: string,
  idemKey: string,
  status: number,
  body: unknown
): void {
  db.ref(`apiIdempotency/${tenantId}/${sha256hex(idemKey)}`)
    .update({ responseBody: JSON.stringify(body), responseStatus: status })
    .catch(() => {});
}
