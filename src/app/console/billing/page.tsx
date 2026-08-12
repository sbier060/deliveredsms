'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { devFetch } from '@/lib/dev-console/api';
import { CONSOLE_MONO, PageHeading } from '@/components/dev-console/ConsoleTable';
import { formatMoney, formatRate, RATES } from '@/lib/api/pricing';

interface BillingResponse {
  plan: 'free' | 'payg';
  status: string;
  billingEnabled: boolean;
  month: string;
  usage: { messages: number; lookups: number; spamScores: number; numbers: number };
  limits: { messagesPerMonth: number | null; messagesPerDay: number; numbersMax: number };
  estimate: {
    lines: Array<{ unit: string; label: string; quantity: number; subtotalMicroUsd: number }>;
    subtotalMicroUsd: number;
  };
  verifiedRecipients: Array<{ phoneNumber: string; verifiedAt: number }>;
  maxVerifiedRecipients: number;
  paymentMethod: { brand: string; last4: string } | null;
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#1C1C1E]">
      <div className="h-full rounded-full bg-[#918E86]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function BillingPage() {
  const [data, setData] = useState<BillingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'idle' | 'sent'>('idle');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await devFetch<BillingResponse>('/api/developers/billing'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing');
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) void load();
    });
  }, [load]);

  const sendCode = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await devFetch('/api/developers/verify-recipient', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      setStage('sent');
      setNotice('Code sent — check that phone.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not send code');
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await devFetch('/api/developers/verify-recipient', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      });
      setStage('idle');
      setPhone('');
      setCode('');
      setNotice('Verified — you can text that number now.');
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not verify');
    } finally {
      setBusy(false);
    }
  };

  const addCard = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await devFetch<{ url: string }>('/api/developers/billing/checkout', {
        method: 'POST',
      });
      window.location.href = res.url;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not start checkout');
      setBusy(false);
    }
  };

  const openPortal = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await devFetch<{ url: string }>('/api/developers/billing/portal', {
        method: 'POST',
      });
      window.location.href = res.url;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not open billing portal');
      setBusy(false);
    }
  };

  const removeNumber = async (p: string) => {
    await devFetch(`/api/developers/verify-recipient?phone=${encodeURIComponent(p)}`, {
      method: 'DELETE',
    }).catch(() => {});
    await load();
  };

  if (error) return <p className="text-[14px] text-[#C9C6BF]">{error}</p>;
  if (!data) return <p className="text-[14px] text-[#918E86]">Loading…</p>;

  const isFree = data.plan === 'free';
  const INPUT =
    'w-full rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3.5 py-2.5 text-[14px] text-[#F2F2F7] placeholder-[#8E8E93] outline-none transition-colors duration-150 focus:border-[#00D26A]';

  return (
    <div>
      <PageHeading
        title="Billing"
        subtitle={
          isFree
            ? 'You are on the free tier. Add a payment method to lift every cap and text anyone.'
            : 'Usage-based billing. We charge on the 1st for the month just ended.'
        }
      />

      {/* This month */}
      <div className="rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
            This month
          </p>
          <p className={`text-[22px] tabular-nums text-[#EFEEEC] ${CONSOLE_MONO}`}>
            {formatMoney(data.estimate.subtotalMicroUsd)}
          </p>
        </div>
        {data.estimate.lines.length > 0 ? (
          <ul className="mt-4 divide-y divide-[#2E2C28]">
            {data.estimate.lines.map((line) => (
              <li
                key={line.unit}
                className="flex items-baseline justify-between gap-3 py-2.5 text-[14px]"
              >
                <span className="text-[#C9C6BF]">
                  {line.label}
                  <span className="ml-2 text-[13px] text-[#918E86]">
                    × {line.quantity.toLocaleString()}
                  </span>
                </span>
                <span className={`tabular-nums text-[#918E86] ${CONSOLE_MONO}`}>
                  {formatMoney(line.subtotalMicroUsd)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[14px] text-[#918E86]">No usage yet this month.</p>
        )}
        <p className="mt-4 text-[12px] text-[#918E86]">
          Estimate — your invoice on the 1st is authoritative. Outbound is{' '}
          {formatRate(RATES.outbound_sms.microUsd)} a message, all-in.
        </p>
      </div>

      {/* Free-tier meters */}
      {isFree && data.limits.messagesPerMonth !== null && (
        <div className="mt-6 rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-5">
          <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
            Free tier
          </p>
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-[14px]">
              <span className="text-[#C9C6BF]">Live messages this month</span>
              <span className={`tabular-nums text-[#EFEEEC] ${CONSOLE_MONO}`}>
                {data.usage.messages} / {data.limits.messagesPerMonth}
              </span>
            </div>
            <Bar value={data.usage.messages} max={data.limits.messagesPerMonth} />
          </div>
          <p className="mt-4 text-[13px] leading-[1.6] text-[#918E86]">
            Also capped at {data.limits.messagesPerDay} a day. Sandbox is
            unlimited and never counts.
          </p>
        </div>
      )}

      {/* Verified recipients */}
      {isFree && (
        <div className="mt-6 rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-5">
          <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
            Verified numbers
          </p>
          <p className="mt-2 text-[13px] leading-[1.6] text-[#918E86]">
            On the free tier, live texts go only to numbers you have verified (up
            to {data.maxVerifiedRecipients}). Add a payment method to text anyone.
          </p>

          {data.verifiedRecipients.length > 0 && (
            <ul className="mt-4 divide-y divide-[#2E2C28] border-y border-[#2E2C28]">
              {data.verifiedRecipients.map((r) => (
                <li
                  key={r.phoneNumber}
                  className="flex items-center justify-between py-2.5"
                >
                  <span className={`text-[14px] text-[#EFEEEC] ${CONSOLE_MONO}`}>
                    {r.phoneNumber}
                  </span>
                  <button
                    onClick={() => removeNumber(r.phoneNumber)}
                    className="text-[13px] text-[#918E86] underline underline-offset-4 hover:text-[#EFEEEC]"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 space-y-3">
            {stage === 'idle' ? (
              <>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 415 555 0132"
                  className={INPUT}
                />
                <button
                  onClick={sendCode}
                  disabled={busy || !phone}
                  className="rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86] disabled:opacity-30"
                >
                  Send code
                </button>
              </>
            ) : (
              <>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                  className={INPUT}
                />
                <div className="flex items-center gap-4">
                  <button
                    onClick={confirmCode}
                    disabled={busy || !code}
                    className="rounded-full bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-6 py-2.5 text-[14px] text-white transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
                  >
                    Verify
                  </button>
                  <button
                    onClick={() => setStage('idle')}
                    className="text-[14px] text-[#918E86] underline underline-offset-4 hover:text-[#EFEEEC]"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
            {notice && <p className="text-[13px] text-[#C9C6BF]">{notice}</p>}
          </div>
        </div>
      )}

      {/* Payment method */}
      <div className="mt-6 rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-5">
        <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
          Payment method
        </p>

        {data.paymentMethod ? (
          <>
            <p className={`mt-3 text-[15px] text-[#EFEEEC] ${CONSOLE_MONO}`}>
              {data.paymentMethod.brand.toUpperCase()} •••• {data.paymentMethod.last4}
            </p>
            <button
              onClick={() => void openPortal()}
              disabled={busy}
              className="mt-4 rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86] disabled:opacity-30"
            >
              Manage billing
            </button>
          </>
        ) : data.billingEnabled ? (
          <>
            <p className="mt-2 text-[14px] leading-[1.6] text-[#C9C6BF]">
              Add a card to lift every cap, text anyone, and unlock live carrier
              lookups. You&apos;re billed on the 1st for the month just ended —
              no platform fee, no minimum.
            </p>
            <button
              onClick={() => void addCard()}
              disabled={busy}
              className="mt-4 rounded-full bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-6 py-2.5 text-[14px] text-white transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
            >
              Add a card
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-[14px] leading-[1.6] text-[#C9C6BF]">
              Card billing is switching on shortly. In the meantime, ask us and
              we&apos;ll raise your limits by hand — usually same day.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Link
                href="/console/settings"
                className="rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86]"
              >
                Request higher limits
              </Link>
              <Link
                href="/pricing"
                className="text-[14px] text-[#918E86] underline underline-offset-4 hover:text-[#EFEEEC]"
              >
                See pricing
              </Link>
            </div>
          </>
        )}

        {notice && <p className="mt-3 text-[13px] text-[#C9C6BF]">{notice}</p>}
        <p className="mt-4 text-[12px] text-[#918E86]">
          Delivered billing is standalone — one usage invoice, nothing else.
        </p>
      </div>
    </div>
  );
}
