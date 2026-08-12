'use client';

import { useState } from 'react';
import { devFetch, type DevKey } from '@/lib/dev-console/api';
import { stashKeyOnce } from '@/lib/dev-console/key-once';

const MONO =
  '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';

/**
 * One-click first message. The single biggest lever on activation: sending the
 * first text should never require a terminal (and on mobile there isn't one).
 * This fires the REAL POST /v1/messages with the developer's REAL key — the
 * same request the curl makes — so `firstCallAt` is set by the genuine path.
 *
 * Returning users have no plaintext key (keys are hashed at rest), so instead
 * of a dead end we mint one on demand and stash it for the session.
 */
export default function SendItNow({
  apiKey,
  from,
  onSent,
}: {
  apiKey: string | null;
  from: string;
  onSent: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      let key = apiKey;
      if (!key) {
        const minted = await devFetch<{ key: DevKey }>('/api/developers/keys', {
          method: 'POST',
          body: JSON.stringify({ mode: 'test', name: 'Console key' }),
        });
        key = minted.key.key || null;
        if (key) stashKeyOnce(key, from);
      }
      if (!key) throw new Error('Could not create an API key');

      const res = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: '+15005550006',
          body: 'Hello from OpenSMS',
        }),
      });
      const body = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        const err = body.error as { message?: string } | undefined;
        throw new Error(err?.message || `Request failed (${res.status})`);
      }
      setResult(body);
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="mt-4">
        <p className="text-[13px] text-[#C9C6BF]">
          Sent — here&apos;s the real API response:
        </p>
        <pre
          className={`mt-2 overflow-x-auto rounded-xl border border-[#2C2C2E] bg-[#111112] p-4 text-[12px] leading-relaxed text-[#918E86] ${MONO}`}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={send}
          disabled={busy}
          className="rounded-full bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-7 py-[13px] text-[15px] text-white transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
        >
          {busy ? 'Sending…' : 'Send it now →'}
        </button>
        <span className="text-[13px] text-[#918E86]">
          or run the command yourself
        </span>
      </div>
      {error && <p className="mt-3 text-[13px] text-[#C9C6BF]">{error}</p>}
    </div>
  );
}
