'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { devFetch } from '@/lib/dev-console/api';
import { CONSOLE_MONO, PageHeading, EmptyState } from '@/components/dev-console/ConsoleTable';

interface Job {
  id: string;
  to: string;
  from: string;
  body: string;
  runAt: number;
  broadcastId?: string;
}

export default function ScheduledPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setJobs((await devFetch<{ scheduled: Job[] }>('/api/developers/scheduled')).scheduled);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => { if (u) void load(); }), [load]);

  const cancel = async (id: string) => {
    setBusy(true);
    try {
      await devFetch(`/api/developers/scheduled?id=${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  };

  if (error && !jobs) return <p className="text-[14px] text-[#C9C6BF]">{error}</p>;
  if (!jobs) return <p className="text-[14px] text-[#918E86]">Loading…</p>;

  return (
    <div>
      <PageHeading
        title="Scheduled"
        subtitle="Messages queued for later. Opt-outs and quota are re-checked at send time."
      />
      {jobs.length === 0 ? (
        <div className="mt-6">
          <EmptyState message="Nothing scheduled. Add scheduled_at to a send, or schedule a broadcast." />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-[#2E2C28]">
          <ul className="divide-y divide-[#2E2C28]">
            {jobs.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-3 bg-[#0F0E0C] px-5 py-4">
                <div className="min-w-0">
                  <p className={`text-[14px] text-[#EFEEEC] ${CONSOLE_MONO}`}>{j.to}</p>
                  <p className="truncate text-[13px] text-[#918E86]">{j.body}</p>
                  <p className="mt-0.5 text-[12px] text-[#5C5A55]">
                    {new Date(j.runAt).toLocaleString()}
                    {j.broadcastId && ' · part of a broadcast'}
                  </p>
                </div>
                <button
                  onClick={() => void cancel(j.id)}
                  disabled={busy}
                  className="flex-shrink-0 text-[13px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC] disabled:opacity-30"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && jobs && <p className="mt-3 text-[13px] text-[#C9C6BF]">{error}</p>}
    </div>
  );
}
