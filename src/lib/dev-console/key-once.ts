'use client';

/**
 * One-time key stash: lets the docs prefill snippets with the key minted at
 * signup without the server ever storing it in plaintext. Tab-scoped
 * (sessionStorage) - an accepted tradeoff, documented in the console UI.
 */

const KEY = 'ghost_dev_key_once';
const NUMBER_KEY = 'ghost_dev_sandbox_number';

export function stashKeyOnce(key: string, sandboxNumber?: string): void {
  try {
    sessionStorage.setItem(KEY, key);
    if (sandboxNumber) sessionStorage.setItem(NUMBER_KEY, sandboxNumber);
  } catch {}
}

export function readKeyOnce(): { key: string | null; sandboxNumber: string | null } {
  try {
    return {
      key: sessionStorage.getItem(KEY),
      sandboxNumber: sessionStorage.getItem(NUMBER_KEY),
    };
  } catch {
    return { key: null, sandboxNumber: null };
  }
}

export function clearKeyOnce(): void {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(NUMBER_KEY);
  } catch {}
}
