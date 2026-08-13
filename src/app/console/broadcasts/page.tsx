'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { devFetch, type DevTenant } from '@/lib/dev-console/api';
import { Mixpanel } from '@/lib/mixpanel';
import { PageHeading, EmptyState, StatusPill, relativeTime } from '@/components/dev-console/ConsoleTable';

const INPUT =
  'w-full rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3.5 py-2.5 text-[14px] text-[#F2F2F7] placeholder-[#8E8E93] outline-none transition-colors duration-150 focus:border-[#00D26A]';

interface Broadcast {
  id: string;
  name: string;
  body: string;
  from: string;
  status: 'scheduled' | 'sending' | 'complete';
  scheduledAt?: number;
  counts: { total: number; sent: number; failed: number; skipped_opt_out: number };
  createdBy: string;
  createdAt: number;
}

interface Contact { id: string; tags: string[] }

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[] | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [numbers, setNumbers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ name: '', body: '', tag: '', from: '', when: '' });
  const [audienceCount, setAudienceCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setBroadcasts((await devFetch<{ broadcasts: Broadcast[] }>('/api/developers/broadcasts')).broadcasts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load broadcasts');
    }
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (!u) return;
        void load();
        void devFetch<{ contacts: Contact[] }>('/api/developers/contacts')
          .then((r) => setTags([...new Set(r.contacts.flatMap((c) => c.tags))].sort()))
          .catch(() => {});
        void devFetch<{ tenant: DevTenant }>('/api/developers/tenant')
          .then((r) => {
            const nums = (r.tenant.numbers || []).map((n) => n.phone_number);
            setNumbers(nums);
            setDraft((d) => ({ ...d, from: d.from || nums[0] || '' }));
          })
          .catch(() => {});
      }),
    [load]
  );

  // Live audience count as the tag changes.
  useEffect(() => {
    if (!draft.tag) { setAudienceCount(null); return; }
    const t = setTimeout(() => {
      void devFetch<{ count: number }>(`/api/developers/broadcasts?preview=1&tags=${encodeURIComponent(draft.tag)}`)
        .then((r) => setAudienceCount(r.count))
        .catch(() => setAudienceCount(null));
    }, 300);
    return () => clearTimeout(t);
  }, [draft.tag]);

  // Poll while anything is sending.
  useEffect(() => {
    if (!broadcasts?.some((b) => b.status !== 'complete')) return;
    const t = setInterval(() => void load(), 10000);
    return () => clearInterval(t);
  }, [broadcasts, load]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const scheduledAt = draft.when ? new Date(draft.when).getTime() : undefined;
      await devFetch('/api/developers/broadcasts', {
        method: 'POST',
        body: JSON.stringify({
          name: draft.name,
          body: draft.body,
          from: draft.from,
          tags: [draft.tag],
          ...(scheduledAt ? { scheduledAt } : {}),
        }),
      });
      Mixpanel.track('Broadcast Created', { scheduled: !!scheduledAt, product: 'developer_api' });
      setShowNew(false);
      setDraft((d) => ({ ...d, name: '', body: '', tag: '', when: '' }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create broadcast');
    } finally {
      setBusy(false);
    }
  };

  if (error && !broadcasts) return <p className="text-[14px] text-[#C9C6BF]">{error}</p>;
  if (!broadcasts) return <p className="text-[14px] text-[#918E86]">Loading…</p>;

  return (
    <div>
      <div className="flex items-start justify-between">
        <PageHeading
          title="Broadcasts"
          subtitle="One message to a tag of contacts, sent as individual texts. Merge fields personalize each one; opted-out contacts are skipped automatically."
        />
        <button
          onClick={() => setShowNew((s) => !s)}
          className="rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86]"
        >
          New broadcast
        </button>
      </div>

      {showNew && (
        <div className="mt-6 space-y-3 rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-4">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Internal name (e.g. March promo)" className={INPUT} />
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder="Hi {{first_name}}, your appointment is tomorrow. Reply STOP to opt out."
            rows={3}
            className={`${INPUT} resize-none`}
          />
          <div className="flex flex-wrap items-center gap-3">
            <select value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} className="rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3 py-2 text-[14px] text-[#F2F2F7] outline-none focus:border-[#00D26A]">
              <option value="">Audience tag…</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {audienceCount !== null && (
              <span className="text-[13px] text-[#918E86]">{audienceCount} recipient{audienceCount === 1 ? '' : 's'}</span>
            )}
            <select value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className="rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3 py-2 text-[14px] text-[#F2F2F7] outline-none focus:border-[#00D26A]">
              {numbers.map((n) => <option key={n} value={n}>from {n}</option>)}
            </select>
            <input type="datetime-local" value={draft.when} onChange={(e) => setDraft({ ...draft, when: e.target.value })} className="rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3 py-2 text-[14px] text-[#F2F2F7] outline-none focus:border-[#00D26A]" />
          </div>
          <button
            onClick={create}
            disabled={busy || !draft.name || !draft.body || !draft.tag || !draft.from}
            className="rounded-full bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-7 py-[10px] text-[14px] text-white transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
          >
            {draft.when ? 'Schedule broadcast' : 'Send broadcast'}
          </button>
          {error && <p className="text-[13px] text-[#C9C6BF]">{error}</p>}
        </div>
      )}

      {broadcasts.length === 0 ? (
        <div className="mt-6">
          <EmptyState message="No broadcasts yet. Tag some contacts, then send your first one." />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-[#2E2C28]">
          <ul className="divide-y divide-[#2E2C28]">
            {broadcasts.map((b) => (
              <li key={b.id} className="bg-[#0F0E0C] px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[15px] text-[#EFEEEC]">{b.name}</p>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <StatusPill status={b.status} />
                    <span className="text-[12px] text-[#918E86]">{relativeTime(new Date(b.createdAt).toISOString())}</span>
                  </div>
                </div>
                <p className="mt-1 truncate text-[13px] text-[#918E86]">{b.body}</p>
                <p className="mt-2 text-[12px] text-[#918E86]">
                  {b.counts.sent}/{b.counts.total} sent
                  {b.counts.skipped_opt_out > 0 && <> · {b.counts.skipped_opt_out} opted out</>}
                  {b.counts.failed > 0 && <> · {b.counts.failed} failed</>}
                  {' · by '}{b.createdBy}
                  {b.scheduledAt && b.status === 'scheduled' && <> · scheduled {new Date(b.scheduledAt).toLocaleString()}</>}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
