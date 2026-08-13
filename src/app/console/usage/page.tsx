'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { devFetch } from '@/lib/dev-console/api';

interface UsageMonth {
  month: string;
  messages: number;
  lookups: number;
  requests: number;
}

interface UsageResponse {
  months: UsageMonth[];
  quotas: { messagesPerDay: number; numbersMax: number; lookupsPerDay: number };
}

function Bar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 2;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1C1C1E]">
      <div
        className="h-full rounded-full bg-[#918E86]"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUsage(await devFetch<UsageResponse>('/api/developers/usage?months=3'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load usage');
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) void load();
    });
  }, [load]);

  if (error) return <p className="text-[14px] text-[#C9C6BF]">{error}</p>;
  if (!usage) return <p className="text-[14px] text-[#918E86]">Loading…</p>;

  const maxMessages = Math.max(1, ...usage.months.map((m) => m.messages));
  const maxLookups = Math.max(1, ...usage.months.map((m) => m.lookups));

  return (
    <div>
      <h1 className="text-[22px] tracking-[-0.02em] text-[#EFEEEC]">Usage</h1>
      <p className="mt-2 text-[14px] leading-[1.6] text-[#918E86]">
        Daily quotas: {usage.quotas.messagesPerDay.toLocaleString()} messages ·{' '}
        {usage.quotas.lookupsPerDay.toLocaleString()} lookups ·{' '}
        {usage.quotas.numbersMax} numbers.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-[#2E2C28]">
        <table className="w-full text-left text-[14px]">
          <thead className="bg-[#0F0E0C] text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
            <tr>
              <th className="px-5 py-3 font-normal">Month</th>
              <th className="px-5 py-3 font-normal">Messages</th>
              <th className="px-5 py-3 font-normal">Lookups</th>
              <th className="px-5 py-3 font-normal">Requests</th>
            </tr>
          </thead>
          <tbody>
            {usage.months.map((m) => (
              <tr key={m.month} className="border-t border-[#2E2C28]">
                <td className="px-5 py-4 text-[#EFEEEC]">{m.month}</td>
                <td className="px-5 py-4">
                  <p className="tabular-nums text-[#C9C6BF]">
                    {m.messages.toLocaleString()}
                  </p>
                  <div className="mt-1.5 max-w-[160px]">
                    <Bar value={m.messages} max={maxMessages} />
                  </div>
                </td>
                <td className="px-5 py-4">
                  <p className="tabular-nums text-[#C9C6BF]">
                    {m.lookups.toLocaleString()}
                  </p>
                  <div className="mt-1.5 max-w-[160px]">
                    <Bar value={m.lookups} max={maxLookups} />
                  </div>
                </td>
                <td className="px-5 py-4 tabular-nums text-[#918E86]">
                  {m.requests.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
