'use client';

import { useState } from 'react';
import { devFetch, type DevTenant } from '@/lib/dev-console/api';

const MONO =
  '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';

export default function QuotaCard({
  tenant,
  onTenantChange,
}: {
  tenant: DevTenant;
  onTenantChange: (t: DevTenant) => void;
}) {
  const [useCase, setUseCase] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async () => {
    if (!useCase.trim()) {
      setError('Tell us what you are building.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await devFetch('/api/developers/live-access', {
        method: 'POST',
        body: JSON.stringify({ useCase }),
      });
      onTenantChange({ ...tenant, liveAccess: 'requested' });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
          Account
        </p>
        <p className={`text-[12px] text-[#918E86] ${MONO}`}>{tenant.id}</p>
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

      {tenant.numbers.length > 0 && (
        <p className={`mt-4 text-[13px] text-[#918E86] ${MONO}`}>
          {tenant.numbers.map((n) => n.phone_number).join(' · ')}
        </p>
      )}

      <div className="mt-6 border-t border-[#2E2C28] pt-5">
        {tenant.liveAccess === 'granted' ? (
          <p className="text-[14px] text-[#C9C6BF]">
            Live access is enabled. Mint a live key from the Keys tab.
          </p>
        ) : tenant.liveAccess === 'requested' ? (
          <p className="text-[14px] text-[#918E86]">
            Live access requested. We usually flip the switch same day.
          </p>
        ) : !open ? (
          <button
            onClick={() => setOpen(true)}
            className="rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86]"
          >
            Request live access
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-[14px] leading-[1.6] text-[#C9C6BF]">
              Live access is free. Tell us what you&apos;re sending and
              we&apos;ll flip the switch, usually same day.
            </p>
            <textarea
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              placeholder="What are you building?"
              rows={3}
              className="w-full rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3.5 py-2.5 text-[14px] text-[#F2F2F7] placeholder-[#8E8E93] outline-none transition-colors duration-150 focus:border-[#00D26A]"
            />
            <div className="flex items-center gap-4">
              <button
                onClick={request}
                disabled={busy}
                className="rounded-full bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-6 py-2.5 text-[14px] text-white transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
              >
                Send request
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-[14px] text-[#918E86] underline underline-offset-4 hover:text-[#EFEEEC]"
              >
                Cancel
              </button>
            </div>
            {error && <p className="text-[13px] text-[#C9C6BF]">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
