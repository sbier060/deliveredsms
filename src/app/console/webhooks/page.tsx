'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Copy, Check } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { devFetch, type DevWebhook } from '@/lib/dev-console/api';
import { Mixpanel } from '@/lib/mixpanel';

const MONO =
  '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';

function SecretRow({ secret }: { secret: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex items-center gap-2">
      <code className={`text-[12px] text-[#918E86] ${MONO}`}>
        {shown ? secret : `${secret.slice(0, 9)}${'•'.repeat(12)}`}
      </code>
      <button
        onClick={() => setShown((s) => !s)}
        className="text-[11px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
      >
        {shown ? 'Hide' : 'Reveal'}
      </button>
      <button
        onClick={() => {
          void copyToClipboard(secret);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="flex items-center gap-1 text-[11px] text-[#8E8E93] transition-colors duration-150 hover:text-[#F2F2F7]"
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
    </span>
  );
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<DevWebhook[] | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await devFetch<{ webhooks: DevWebhook[] }>('/api/developers/webhooks');
      setWebhooks(res.webhooks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load webhooks');
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

  const addEndpoint = () =>
    act(async () => {
      await devFetch('/api/developers/webhooks', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      setUrl('');
      Mixpanel.track('Webhook Endpoint Created', { product: 'developer_api' });
    });

  const toggle = (w: DevWebhook) =>
    act(async () => {
      await devFetch(`/api/developers/webhooks/${w.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !w.active }),
      });
    });

  const remove = (id: string) =>
    act(async () => {
      await devFetch(`/api/developers/webhooks/${id}`, { method: 'DELETE' });
    });

  const sendTest = async (id: string) => {
    setTestResult((r) => ({ ...r, [id]: 'sending…' }));
    try {
      const res = await devFetch<{
        result: { ok: boolean; status?: number; ms: number; error?: string };
      }>(`/api/developers/webhooks/${id}/test`, { method: 'POST' });
      const r = res.result;
      setTestResult((prev) => ({
        ...prev,
        [id]: r.ok
          ? `✓ ${r.status} in ${r.ms}ms`
          : `✗ ${r.error ?? `HTTP ${r.status}`} (${r.ms}ms)`,
      }));
    } catch (e) {
      setTestResult((prev) => ({
        ...prev,
        [id]: e instanceof Error ? e.message : 'test failed',
      }));
    }
  };

  return (
    <div>
      <h1 className="text-[22px] tracking-[-0.02em] text-[#EFEEEC]">Webhooks</h1>
      <p className="mt-2 text-[14px] leading-[1.6] text-[#918E86]">
        We POST every event (inbound messages, delivery updates, verification
        results) to your endpoint, signed with your secret. Failures retry
        automatically for 12 hours.
      </p>

      <div className="mt-6 flex gap-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://yourapp.com/webhooks/delivered"
          className={`flex-1 rounded-lg border border-[#2E2C28] bg-[#0F0E0C] px-3.5 py-2.5 text-[14px] text-[#EFEEEC] placeholder-[#5C5A55] outline-none transition-colors duration-150 focus:border-[#918E86] ${MONO}`}
        />
        <button
          onClick={addEndpoint}
          disabled={busy || !url.trim()}
          className="rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86] disabled:opacity-30"
        >
          Add endpoint
        </button>
      </div>

      {error && <p className="mt-4 text-[13px] text-[#C9C6BF]">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-xl border border-[#2E2C28]">
        {webhooks === null ? (
          <p className="p-5 text-[14px] text-[#918E86]">Loading…</p>
        ) : webhooks.length === 0 ? (
          <p className="p-5 text-[14px] text-[#918E86]">
            No endpoints yet. Add one above; all events are sent by default.
          </p>
        ) : (
          <ul className="divide-y divide-[#2E2C28]">
            {webhooks.map((w) => (
              <li key={w.id} className="bg-[#0F0E0C] px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className={`break-all text-[14px] text-[#EFEEEC] ${MONO}`}>
                    {w.url}
                    <span className="ml-2 rounded-md border border-[#2C2C2E] bg-[#1C1C1E] px-1.5 py-0.5 text-[11px] text-[#918E86]">
                      {w.active ? 'active' : 'paused'}
                    </span>
                    <span className="ml-1 rounded-md border border-[#2C2C2E] px-1.5 py-0.5 text-[11px] text-[#918E86]">
                      {w.events === '*' ? 'all events' : `${w.events.length} events`}
                    </span>
                  </p>
                  <div className="flex items-center gap-4 text-[13px]">
                    <button
                      onClick={() => sendTest(w.id)}
                      disabled={busy}
                      className="text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC] disabled:opacity-30"
                    >
                      Send test
                    </button>
                    <button
                      onClick={() => toggle(w)}
                      disabled={busy}
                      className="text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC] disabled:opacity-30"
                    >
                      {w.active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => remove(w.id)}
                      disabled={busy}
                      className="text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC] disabled:opacity-30"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <SecretRow secret={w.secret} />
                  {testResult[w.id] && (
                    <span className={`text-[12px] text-[#918E86] ${MONO}`}>
                      {testResult[w.id]}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-[13px] leading-[1.6] text-[#918E86]">
        Verify every request with the signing secret; see the{' '}
        <a
          href="/docs/webhooks"
          className="text-[#C9C6BF] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
        >
          webhooks docs
        </a>{' '}
        for the four-line check.
      </p>
    </div>
  );
}
