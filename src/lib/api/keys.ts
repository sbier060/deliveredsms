import { db } from '@/lib/firebase-admin';
import { newKeyId, newKeySecret, sha256hex } from './ids';
import type { ApiKeyRecord, KeyMode } from './types';

/**
 * API key store. Secrets are stored sha256-hashed (pattern:
 * src/lib/account-recovery.ts) and the raw secret is returned exactly once at
 * mint time. Lookup is O(1) by hash; per-tenant listing goes through the
 * apiKeysByTenant index.
 */

export interface MintedKey {
  keyId: string;
  secret: string; // full secret — show once, never persisted
  record: ApiKeyRecord;
}

export async function mintKey(input: {
  tenantId: string;
  mode: KeyMode;
  name?: string;
}): Promise<MintedKey> {
  const secret = newKeySecret(input.mode);
  const hash = sha256hex(secret);
  const keyId = newKeyId();
  const record: ApiKeyRecord = {
    tenantId: input.tenantId,
    keyId,
    mode: input.mode,
    prefix: secret.slice(0, secret.indexOf(`_${input.mode}_`) + `_${input.mode}_`.length + 4),
    name: input.name || (input.mode === 'test' ? 'Test key' : 'Live key'),
    createdAt: Date.now(),
  };
  await db.ref(`apiKeys/${hash}`).set(record);
  await db.ref(`apiKeysByTenant/${input.tenantId}/${keyId}`).set(hash);
  return { keyId, secret, record };
}

export async function getKeyBySecret(
  secret: string
): Promise<{ hash: string; record: ApiKeyRecord } | null> {
  const hash = sha256hex(secret);
  const snap = await db.ref(`apiKeys/${hash}`).get();
  if (!snap.exists()) return null;
  return { hash, record: snap.val() as ApiKeyRecord };
}

export async function listKeys(tenantId: string): Promise<ApiKeyRecord[]> {
  const idx = await db.ref(`apiKeysByTenant/${tenantId}`).get();
  if (!idx.exists()) return [];
  const hashes = Object.values(idx.val() as Record<string, string>);
  const records = await Promise.all(
    hashes.map(async (h) => {
      const s = await db.ref(`apiKeys/${h}`).get();
      return s.exists() ? (s.val() as ApiKeyRecord) : null;
    })
  );
  return records
    .filter((r): r is ApiKeyRecord => r !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function revokeKey(
  tenantId: string,
  keyId: string
): Promise<boolean> {
  const hashSnap = await db.ref(`apiKeysByTenant/${tenantId}/${keyId}`).get();
  if (!hashSnap.exists()) return false;
  const hash = hashSnap.val() as string;
  await db.ref(`apiKeys/${hash}/revokedAt`).set(Date.now());
  return true;
}

/** Fire-and-forget lastUsedAt update. */
export function touchKey(hash: string): void {
  db.ref(`apiKeys/${hash}/lastUsedAt`)
    .set(Date.now())
    .catch(() => {});
}
