'use client';

import { useEffect, useState } from 'react';
import { devFetch } from '@/lib/dev-console/api';

const INPUT =
  'w-full rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3.5 py-2.5 text-[14px] text-[#F2F2F7] placeholder-[#8E8E93] outline-none transition-colors duration-150 focus:border-[#00D26A]';

interface Config {
  enabled: boolean;
  message: string;
  officeHours?: { tz: string; days: number[]; start: string; end: string; mode: 'always' | 'after_hours' };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Per-number auto-reply settings, collapsed under each number row. */
export default function AutoReplyCard({ number }: { number: string }) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useHours, setUseHours] = useState(false);

  useEffect(() => {
    if (!open || config) return;
    void devFetch<{ config: Config | null }>(`/api/developers/auto-reply?number=${encodeURIComponent(number)}`)
      .then((r) => {
        const c = r.config || { enabled: false, message: '' };
        setConfig(c);
        setUseHours(!!c.officeHours);
      })
      .catch(() => setConfig({ enabled: false, message: '' }));
  }, [open, config, number]);

  const save = async () => {
    if (!config) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await devFetch('/api/developers/auto-reply', {
        method: 'PUT',
        body: JSON.stringify({
          number,
          enabled: config.enabled,
          message: config.message,
          ...(useHours && config.officeHours ? { officeHours: config.officeHours } : {}),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const hours = config?.officeHours || {
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    days: [1, 2, 3, 4, 5],
    start: '09:00',
    end: '17:00',
    mode: 'after_hours' as const,
  };

  return (
    <div className="border-t border-[#2C2C2E] px-5 py-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[13px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
      >
        Auto-reply {open ? '▴' : '▾'}
      </button>

      {open && config && (
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-[14px] text-[#C9C6BF]">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="accent-[#00D26A]"
            />
            Reply automatically to inbound texts on this number
          </label>
          <textarea
            value={config.message}
            onChange={(e) => setConfig({ ...config, message: e.target.value.slice(0, 320) })}
            placeholder="Thanks for texting! We'll get back to you within the hour."
            rows={2}
            className={`${INPUT} resize-none`}
          />
          <label className="flex items-center gap-2 text-[14px] text-[#C9C6BF]">
            <input type="checkbox" checked={useHours} onChange={(e) => setUseHours(e.target.checked)} className="accent-[#00D26A]" />
            Only outside office hours
          </label>
          {useHours && (
            <div className="flex flex-wrap items-center gap-2">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  onClick={() => {
                    const days = hours.days.includes(i) ? hours.days.filter((x) => x !== i) : [...hours.days, i];
                    setConfig({ ...config, officeHours: { ...hours, mode: 'after_hours', days } });
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors duration-150 ${
                    hours.days.includes(i)
                      ? 'border-[#00D26A] text-[#00D26A]'
                      : 'border-[#2C2C2E] text-[#918E86]'
                  }`}
                >
                  {d}
                </button>
              ))}
              <input
                type="time"
                value={hours.start}
                onChange={(e) => setConfig({ ...config, officeHours: { ...hours, mode: 'after_hours', start: e.target.value } })}
                className="rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-2 py-1 text-[13px] text-[#F2F2F7]"
              />
              <span className="text-[12px] text-[#918E86]">to</span>
              <input
                type="time"
                value={hours.end}
                onChange={(e) => setConfig({ ...config, officeHours: { ...hours, mode: 'after_hours', end: e.target.value } })}
                className="rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-2 py-1 text-[13px] text-[#F2F2F7]"
              />
              <span className="text-[12px] text-[#918E86]">{hours.tz}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={busy || (config.enabled && !config.message.trim())}
              className="rounded-full border border-[#2E2C28] px-5 py-1.5 text-[13px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86] disabled:opacity-30"
            >
              Save
            </button>
            {saved && <span className="text-[13px] text-[#00D26A]">Saved</span>}
            {error && <span className="text-[13px] text-[#C9C6BF]">{error}</span>}
          </div>
          <p className="text-[12px] leading-relaxed text-[#5C5A55]">
            Never replies to STOP/HELP keywords or verification codes; one reply
            per conversation per 4 hours.
          </p>
        </div>
      )}
    </div>
  );
}
