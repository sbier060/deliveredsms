'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Copy, Check } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { devFetch, type DevKey } from '@/lib/dev-console/api';
import { Mixpanel } from '@/lib/mixpanel';

const MONO =
  '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';

function relative(ts: number | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function RevealedKey({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-4">
      <p className="text-[13px] text-[#C9C6BF]">
        New key — <span className="text-[#FFFFFF]">shown once, copy it now:</span>
      </p>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-[#2C2C2E] bg-[#111112] px-3.5 py-2.5">
        <code className={`overflow-x-auto whitespace-nowrap text-[13px] text-[#EFEEEC] ${MONO}`}>
          {secret}
        </code>
        <button
          onClick={() => {
            void copyToClipboard(secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-[#8E8E93] transition-all duration-150 hover:bg-[#2C2C2E] hover:text-[#F2F2F7]"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-[#00D26A]" />
              <span className="text-[#00D26A]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function KeysPage() {
  const [keys, setKeys] = useState<DevKey[] | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await devFetch<{ keys: DevKey[] }>('/api/developers/keys');
      setKeys(res.keys);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load keys');
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) void load();
    });
  }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const createKey = () =>
    act(async () => {
      const res = await devFetch<{ key: DevKey }>('/api/developers/keys', {
        method: 'POST',
        body: JSON.stringify({ mode: 'test' }),
      });
      if (res.key.key) setRevealed(res.key.key);
      Mixpanel.track('API Key Created', { mode: 'test', product: 'developer_api' });
    });

  const rollKey = (id: string) =>
    act(async () => {
      const res = await devFetch<{ key: DevKey }>(`/api/developers/keys/${id}/roll`, {
        method: 'POST',
      });
      if (res.key.key) setRevealed(res.key.key);
    });

  const revokeKey = (id: string) =>
    act(async () => {
      await devFetch(`/api/developers/keys/${id}`, { method: 'DELETE' });
    });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] tracking-[-0.02em] text-[#EFEEEC]">API keys</h1>
        <button
          onClick={createKey}
          disabled={busy}
          className="rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86] disabled:opacity-30"
        >
          New test key
        </button>
      </div>

      {revealed && <RevealedKey secret={revealed} />}
      {error && <p className="mt-4 text-[13px] text-[#C9C6BF]">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-xl border border-[#2E2C28]">
        {keys === null ? (
          <p className="p-5 text-[14px] text-[#918E86]">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="p-5 text-[14px] text-[#918E86]">No keys yet.</p>
        ) : (
          <ul className="divide-y divide-[#2E2C28]">
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex flex-wrap items-center justify-between gap-3 bg-[#0F0E0C] px-5 py-4"
              >
                <div>
                  <p className={`text-[14px] text-[#EFEEEC] ${MONO}`}>
                    {k.prefix}…{' '}
                    <span className="ml-1 rounded-md border border-[#2C2C2E] bg-[#1C1C1E] px-1.5 py-0.5 text-[11px] text-[#918E86]">
                      {k.mode}
                    </span>
                    {k.status === 'revoked' && (
                      <span className="ml-1 rounded-md border border-[#2C2C2E] px-1.5 py-0.5 text-[11px] text-[#918E86]">
                        revoked
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-[12px] text-[#918E86]">
                    {k.name} · last used {relative(k.lastUsedAt)}
                  </p>
                </div>
                {k.status === 'active' && (
                  <div className="flex items-center gap-4 text-[13px]">
                    <button
                      onClick={() => rollKey(k.id)}
                      disabled={busy}
                      className="text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC] disabled:opacity-30"
                    >
                      Roll
                    </button>
                    <button
                      onClick={() => revokeKey(k.id)}
                      disabled={busy}
                      className="text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC] disabled:opacity-30"
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-[13px] leading-[1.6] text-[#918E86]">
        Keys are stored hashed — we can never show one again after it&apos;s
        minted. Rolling revokes the old key immediately.
      </p>
    </div>
  );
}
