'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { devFetch, type DevTenant } from '@/lib/dev-console/api';
import { CONSOLE_MONO, PageHeading } from '@/components/dev-console/ConsoleTable';
import QuotaCard from '../QuotaCard';

export default function SettingsPage() {
  const [tenant, setTenant] = useState<DevTenant | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await devFetch<{ tenant: DevTenant }>('/api/developers/tenant');
      setTenant(res.tenant);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) void load();
    });
  }, [load]);

  if (error) return <p className="text-[14px] text-[#C9C6BF]">{error}</p>;
  if (!tenant) return <p className="text-[14px] text-[#918E86]">Loading…</p>;

  return (
    <div>
      <PageHeading
        title="Settings"
        subtitle="Your API account, quotas, and live access."
      />

      <div className="mb-8 overflow-hidden rounded-xl border border-[#2E2C28]">
        <dl className="divide-y divide-[#2E2C28]">
          {[
            ['Account', tenant.email],
            ['Account type', 'API developer'],
            ['Tenant ID', tenant.id],
            ['Created', new Date(tenant.createdAt).toLocaleDateString()],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex flex-wrap items-center justify-between gap-2 bg-[#0F0E0C] px-5 py-3.5"
            >
              <dt className="text-[14px] text-[#918E86]">{label}</dt>
              <dd className={`text-[14px] text-[#EFEEEC] ${CONSOLE_MONO}`}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <QuotaCard tenant={tenant} onTenantChange={setTenant} />
    </div>
  );
}
