'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { devFetch, type DevTenant } from '@/lib/dev-console/api';
import {
  CONSOLE_MONO,
  PageHeading,
  EmptyState,
} from '@/components/dev-console/ConsoleTable';
import AutoReplyCard from './AutoReplyCard';
import PortingCard from './PortingCard';

export default function NumbersPage() {
  const [tenant, setTenant] = useState<DevTenant | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await devFetch<{ tenant: DevTenant }>('/api/developers/tenant');
      setTenant(res.tenant);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load numbers');
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) void load();
    });
  }, [load]);

  return (
    <div>
      <PageHeading
        title="Numbers"
        subtitle="Phone numbers on your account. Provision and release them through the API."
      />
      {error && <p className="text-[14px] text-[#C9C6BF]">{error}</p>}
      {tenant === null ? (
        <p className="text-[14px] text-[#918E86]">Loading…</p>
      ) : tenant.numbers.length === 0 ? (
        <EmptyState message="No numbers on this account." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#2E2C28]">
          <ul className="divide-y divide-[#2E2C28]">
            {tenant.numbers.map((n) => (
              <li key={n.phone_number} className="bg-[#0F0E0C]">
                <div className="flex items-center justify-between px-5 py-4">
                  <span className={`text-[15px] text-[#EFEEEC] ${CONSOLE_MONO}`}>
                    {n.phone_number}
                  </span>
                  <span className="rounded-md border border-[#2C2C2E] bg-[#1C1C1E] px-1.5 py-0.5 text-[11px] text-[#918E86]">
                    {n.mode}
                  </span>
                </div>
                <AutoReplyCard number={n.phone_number} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-5">
        <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
          Provision another
        </p>
        <pre
          className={`mt-3 overflow-x-auto text-[13px] leading-relaxed text-[#918E86] ${CONSOLE_MONO}`}
        >{`GET  /v1/numbers/available?area_code=415
POST /v1/numbers            {"phone_number": "+1…"}
DELETE /v1/numbers/+1…`}</pre>
        <p className="mt-3 text-[13px] text-[#918E86]">
          Test keys provision sandbox numbers instantly. Live numbers require
          live access; request it from Settings.
        </p>
      </div>

      <PortingCard isAdmin />
    </div>
  );
}
