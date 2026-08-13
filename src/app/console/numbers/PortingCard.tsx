'use client';

import { useCallback, useEffect, useState } from 'react';
import { devFetch } from '@/lib/dev-console/api';
import { relativeTime } from '@/components/dev-console/ConsoleTable';

const INPUT =
  'w-full rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3.5 py-2.5 text-[14px] text-[#F2F2F7] placeholder-[#8E8E93] outline-none transition-colors duration-150 focus:border-[#00D26A]';

interface PortRequest {
  id: string;
  number: string;
  currentCarrier: string;
  status: string;
  statusLog: Array<{ at: number; status: string; note?: string }>;
  createdAt: number;
}

const STATUS_LABELS: Record<string, string> = {
  requested: 'Request received',
  submitted: 'Filed with carrier',
  foc_set: 'Transfer date set',
  complete: 'Complete: number is live',
  rejected: 'Rejected',
};

/** Bring-your-own-number: intake form + visible status timeline. */
export default function PortingCard({ isAdmin }: { isAdmin: boolean }) {
  const [requests, setRequests] = useState<PortRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ number: '', currentCarrier: '', accountNumber: '', pinLast4: '', authorizedName: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRequests((await devFetch<{ requests: PortRequest[] }>('/api/developers/porting')).requests);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await devFetch('/api/developers/porting', { method: 'POST', body: JSON.stringify(draft) });
      setShowForm(false);
      setDraft({ number: '', currentCarrier: '', accountNumber: '', pinLast4: '', authorizedName: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">Bring your number</p>
          <p className="mt-1 text-[13px] text-[#918E86]">
            Port an existing business number to Delivered. Multi-day carrier
            process; keep your old service active until it completes.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex-shrink-0 rounded-full border border-[#2E2C28] px-4 py-1.5 text-[13px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86]"
          >
            Port a number
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-4 space-y-3">
          <input value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} placeholder="Number to port, e.g. +1 (415) 555-1234" className={INPUT} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input value={draft.currentCarrier} onChange={(e) => setDraft({ ...draft, currentCarrier: e.target.value })} placeholder="Current carrier" className={INPUT} />
            <input value={draft.accountNumber} onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })} placeholder="Account number with them" className={INPUT} />
            <input value={draft.pinLast4} onChange={(e) => setDraft({ ...draft, pinLast4: e.target.value.slice(0, 4) })} placeholder="Account PIN, last 4 (if any)" className={INPUT} />
            <input value={draft.authorizedName} onChange={(e) => setDraft({ ...draft, authorizedName: e.target.value })} placeholder="Authorized person's full name" className={INPUT} />
          </div>
          <button
            onClick={submit}
            disabled={busy || !draft.number || !draft.currentCarrier || !draft.accountNumber || !draft.authorizedName}
            className="rounded-full bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-6 py-[9px] text-[13px] text-white transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
          >
            Submit port request
          </button>
          {error && <p className="text-[13px] text-[#C9C6BF]">{error}</p>}
          <p className="text-[12px] text-[#5C5A55]">
            By submitting you confirm the named person is authorized to approve
            transferring this number.
          </p>
        </div>
      )}

      {requests.map((r) => (
        <div key={r.id} className="mt-4 rounded-lg border border-[#2C2C2E] bg-[#111112] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-[#EFEEEC] [font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]">{r.number}</span>
            <span className="rounded-full border border-[#2C2C2E] bg-[#1C1C1E] px-2.5 py-0.5 text-[11px] text-[#C9C6BF]">
              {STATUS_LABELS[r.status] || r.status}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {(r.statusLog || []).map((entry, i) => (
              <li key={i} className="flex items-baseline gap-2 text-[12px]">
                <span className="text-[#00D26A]">●</span>
                <span className="text-[#C9C6BF]">{STATUS_LABELS[entry.status] || entry.status}</span>
                {entry.note && <span className="text-[#918E86]">· {entry.note}</span>}
                <span className="ml-auto text-[#5C5A55]">{relativeTime(new Date(entry.at).toISOString())}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
