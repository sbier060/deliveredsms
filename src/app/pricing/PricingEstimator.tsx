'use client';

import { useState } from 'react';
import {
  COMPETITORS,
  estimateCost,
  estimateCompetitorCost,
  formatMoney,
  formatRange,
} from '@/lib/api/pricing';

const MONO =
  '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';

const INPUT =
  'w-full rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3.5 py-2.5 text-[14px] text-[#F2F2F7] outline-none transition-colors duration-150 focus:border-[#00D26A]';

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] text-[#918E86]">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={`${INPUT} ${MONO}`}
      />
    </label>
  );
}

export default function PricingEstimator() {
  const [outboundSms, setOutbound] = useState(5000);
  const [numbers, setNumbers] = useState(2);
  const [lookups, setLookups] = useState(0);

  const usage = { outboundSms, numbers, lookups };
  const ours = estimateCost(usage);

  return (
    <div className="rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Texts per month" value={outboundSms} onChange={setOutbound} />
        <Field label="Phone numbers" value={numbers} onChange={setNumbers} />
        <Field label="Lookups per month" value={lookups} onChange={setLookups} />
      </div>

      <div className="mt-6 border-t border-[#2E2C28] pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[14px] text-[#C9C6BF]">Delivered, all-in</span>
          <span className={`text-[28px] tabular-nums text-[#EFEEEC] ${MONO}`}>
            {formatMoney(ours.subtotalMicroUsd)}
            <span className="ml-1 text-[14px] text-[#918E86]">/mo</span>
          </span>
        </div>

        <ul className="mt-4 space-y-1.5">
          {COMPETITORS.map((row) => {
            const band = estimateCompetitorCost(usage, row);
            return (
              <li
                key={row.provider}
                className="flex items-baseline justify-between gap-2 text-[13px]"
              >
                <span className="text-[#918E86]">
                  Same volume on {row.provider}
                </span>
                <span className={`tabular-nums text-[#918E86] ${MONO}`}>
                  {formatRange(band, formatMoney)}
                  {row.carrierFeeMicroUsd === null ? '+' : ''}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-[12px] leading-[1.6] text-[#918E86]">
          Competitor figures use each provider&apos;s published rate plus their
          carrier fees where those are published as a band. Messaging and numbers
          only; lookup products aren&apos;t comparable line-for-line.
        </p>
      </div>
    </div>
  );
}
