'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { devFetch, type DevTenant } from '@/lib/dev-console/api';
import { stashKeyOnce } from '@/lib/dev-console/key-once';
import { Mixpanel } from '@/lib/mixpanel';
import Link from 'next/link';
import OnboardingPanel from './OnboardingPanel';

interface ProvisionResponse {
  tenant: DevTenant;
  isNew: boolean;
  initialKey?: { id: string; key: string; last4: string };
  sandboxNumber?: string;
}

export default function ConsoleOverview() {
  const [tenant, setTenant] = useState<DevTenant | null>(null);
  const [initialKey, setInitialKey] = useState<string | null>(null);
  const [sandboxNumber, setSandboxNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const provisioned = useRef(false);

  const provision = useCallback(async () => {
    if (provisioned.current) return;
    provisioned.current = true;
    try {
      const res = await devFetch<ProvisionResponse>('/api/developers/tenant', {
        method: 'POST',
      });
      setTenant(res.tenant);
      // isNew is the exact signup moment - the tenant record was just created.
      // Identify by Firebase uid so the funnel joins with the rest of the app.
      Mixpanel.identify(auth.currentUser?.uid || res.tenant.id);
      Mixpanel.track(res.isNew ? 'API Signup' : 'API Console Viewed', {
        tenant_id: res.tenant.id,
        tenant_status: res.tenant.status,
        product: 'developer_api',
      });
      if (res.isNew && res.initialKey) {
        setInitialKey(res.initialKey.key);
        const number = res.sandboxNumber || res.tenant.numbers[0]?.phone_number || null;
        setSandboxNumber(number);
        stashKeyOnce(res.initialKey.key, number || undefined);
      }
    } catch (e) {
      provisioned.current = false;
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) void provision();
    });
  }, [provision]);

  // Poll for the "first call received" moment while onboarding is on screen.
  useEffect(() => {
    if (!tenant || tenant.firstCallAt) return;
    let ticks = 0;
    const interval: ReturnType<typeof setInterval> = setInterval(async () => {
      ticks += 1;
      if (ticks > 200) return clearInterval(interval);
      try {
        const res = await devFetch<{ tenant: DevTenant }>('/api/developers/tenant');
        if (res.tenant.firstCallAt) {
          setTenant(res.tenant);
          clearInterval(interval);
          Mixpanel.track('API First Call', {
            tenant_id: res.tenant.id,
            product: 'developer_api',
          });
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [tenant]);

  if (error) {
    return <p className="text-[14px] text-[#C9C6BF]">{error}</p>;
  }
  if (!tenant) {
    return <p className="text-[14px] text-[#918E86]">Setting up your sandbox…</p>;
  }

  return (
    <div className="space-y-10">
      <OnboardingPanel
        tenant={tenant}
        initialKey={initialKey}
        sandboxNumber={sandboxNumber || tenant.numbers[0]?.phone_number || null}
        onFirstCall={() => setTenant({ ...tenant, firstCallAt: Date.now() })}
      />

      {/* Compact account strip - full controls live in Settings. */}
      <div className="rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
            Account
          </p>
          <Link
            href="/console/settings"
            className="text-[13px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
          >
            Settings
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-6 md:grid-cols-4">
          <div>
            <p className="text-[20px] text-[#EFEEEC]">
              {tenant.status === 'live' ? 'Live' : tenant.status === 'sandbox' ? 'Sandbox' : 'Suspended'}
            </p>
            <p className="mt-0.5 text-[13px] text-[#918E86]">mode</p>
          </div>
          <div>
            <p className="text-[20px] tabular-nums text-[#EFEEEC]">
              {tenant.quotas.messagesPerDay.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[13px] text-[#918E86]">messages / day</p>
          </div>
          <div>
            <p className="text-[20px] tabular-nums text-[#EFEEEC]">
              {tenant.quotas.lookupsPerDay.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[13px] text-[#918E86]">lookups / day</p>
          </div>
          <div>
            <p className="text-[20px] tabular-nums text-[#EFEEEC]">
              {tenant.numbers.length} / {tenant.quotas.numbersMax}
            </p>
            <p className="mt-0.5 text-[13px] text-[#918E86]">numbers</p>
          </div>
        </div>
      </div>
    </div>
  );
}
