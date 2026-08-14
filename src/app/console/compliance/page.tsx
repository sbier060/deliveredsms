'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { devFetch } from '@/lib/dev-console/api';
import { CONSOLE_MONO, PageHeading, EmptyState, relativeTime } from '@/components/dev-console/ConsoleTable';

const INPUT =
  'w-full rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3.5 py-2.5 text-[14px] text-[#F2F2F7] placeholder-[#8E8E93] outline-none transition-colors duration-150 focus:border-[#00D26A]';

interface Suppression {
  phone: string;
  at: number;
  via: string;
  method: string | null;
  detected: string | null;
  confidence: number | null;
}

interface HistoryEntry {
  at: number;
  type: string;
  via: string;
  method?: string;
  keyword?: string;
  confidence?: number;
  note?: string;
}

interface Exemption {
  phone: string;
  at: number;
  reason: string;
}

const METHOD_LABELS: Record<string, string> = {
  keyword: 'STOP keyword',
  phrase: 'Plain English',
  ai: 'AI detected',
  api: 'API / console',
  import: 'Imported',
};

const TYPE_LABELS: Record<string, string> = {
  opt_out: 'Opted out',
  opt_in: 'Opted in',
  exempt_send: 'OTP exemption',
  import: 'Imported',
  api_set: 'Set via API',
};

export default function CompliancePage() {
  const [rows, setRows] = useState<Suppression[] | null>(null);
  const [exemptions, setExemptions] = useState<Exemption[]>([]);
  const [q, setQ] = useState('');
  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [importText, setImportText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query = '') => {
    try {
      const [s, e] = await Promise.all([
        devFetch<{ suppressions: Suppression[] }>(`/api/developers/consent?q=${encodeURIComponent(query)}`),
        devFetch<{ exemptions: Exemption[] }>('/api/developers/consent/exemptions'),
      ]);
      setRows(s.suppressions);
      setExemptions(e.exemptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => { if (u) void load(); }), [load]);

  useEffect(() => {
    const t = setTimeout(() => void load(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const openHistory = async (phone: string) => {
    if (openPhone === phone) { setOpenPhone(null); return; }
    setOpenPhone(phone);
    setHistory(null);
    try {
      const r = await devFetch<{ history: HistoryEntry[] }>(`/api/developers/consent/${encodeURIComponent(phone)}`);
      setHistory(r.history);
    } catch {
      setHistory([]);
    }
  };

  const optIn = async (phone: string) => {
    setBusy(true);
    try {
      await devFetch(`/api/developers/consent/${encodeURIComponent(phone)}`, {
        method: 'POST',
        body: JSON.stringify({ status: 'opted_in' }),
      });
      setOpenPhone(null);
      await load(q);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    const numbers = importText.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (numbers.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await devFetch<{ imported: number; skipped: unknown[] }>('/api/developers/consent', {
        method: 'POST',
        body: JSON.stringify({ phone_numbers: numbers.slice(0, 500) }),
      });
      setNotice(`Imported ${r.imported} number${r.imported === 1 ? '' : 's'}${r.skipped.length ? `, skipped ${r.skipped.length}` : ''}.`);
      setImportText('');
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  if (error && !rows) return <p className="text-[14px] text-[#C9C6BF]">{error}</p>;
  if (!rows) return <p className="text-[14px] text-[#918E86]">Loading…</p>;

  return (
    <div>
      <PageHeading
        title="Compliance"
        subtitle="Your consent ledger. Revocations in plain English are honored automatically; every change is recorded and exportable."
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by digits…"
          className={`${INPUT} max-w-xs`}
        />
        <a
          href="/api/developers/consent/export"
          className="rounded-full border border-[#2E2C28] px-4 py-1.5 text-[13px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86]"
        >
          Export CSV
        </a>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState message="No opted-out numbers. When someone replies STOP (or says it in plain English), they appear here." />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-[#2E2C28]">
          <ul className="divide-y divide-[#2E2C28]">
            {rows.map((r) => (
              <li key={r.phone} className="bg-[#0F0E0C]">
                <button onClick={() => void openHistory(r.phone)} className="flex w-full items-center gap-3 px-5 py-3 text-left">
                  <span className={`text-[14px] text-[#EFEEEC] ${CONSOLE_MONO}`}>{r.phone}</span>
                  <span className="rounded-full border border-[#2C2C2E] bg-[#1C1C1E] px-2.5 py-0.5 text-[11px] text-[#C9C6BF]">
                    {METHOD_LABELS[r.method || ''] || r.via}
                  </span>
                  {r.detected && (
                    <span className="hidden truncate text-[13px] text-[#918E86] sm:inline">&ldquo;{r.detected}&rdquo;</span>
                  )}
                  <span className="ml-auto flex-shrink-0 text-[12px] text-[#5C5A55]">
                    {relativeTime(new Date(r.at).toISOString())}
                  </span>
                </button>
                {openPhone === r.phone && (
                  <div className="border-t border-[#2C2C2E] px-5 py-3">
                    {history === null ? (
                      <p className="text-[13px] text-[#918E86]">Loading history…</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {history.map((h, i) => (
                          <li key={i} className="flex items-baseline gap-2 text-[12px]">
                            <span className="text-[#00D26A]">●</span>
                            <span className="text-[#C9C6BF]">{TYPE_LABELS[h.type] || h.type}</span>
                            <span className="text-[#918E86]">
                              {h.method ? METHOD_LABELS[h.method] || h.method : h.via}
                              {h.keyword ? ` · "${h.keyword}"` : ''}
                              {h.confidence !== undefined ? ` · ${(h.confidence * 100).toFixed(0)}%` : ''}
                            </span>
                            <span className="ml-auto text-[#5C5A55]">{relativeTime(new Date(h.at).toISOString())}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      onClick={() => void optIn(r.phone)}
                      disabled={busy}
                      className="mt-3 text-[13px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC] disabled:opacity-30"
                    >
                      Opt back in (use only with the person&apos;s consent)
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-5">
        <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">Import a suppression list</p>
        <p className="mt-1 text-[13px] text-[#918E86]">
          Migrating from another provider? Paste numbers (comma, space, or newline separated) and they are suppressed immediately.
        </p>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder={'+14155550132\n+16155550176'}
          rows={3}
          className={`${INPUT} mt-3 resize-none ${CONSOLE_MONO}`}
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => void runImport()}
            disabled={busy || !importText.trim()}
            className="rounded-full border border-[#2E2C28] px-5 py-1.5 text-[13px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86] disabled:opacity-30"
          >
            Import
          </button>
          {notice && <span className="text-[13px] text-[#00D26A]">{notice}</span>}
          {error && rows && <span className="text-[13px] text-[#C9C6BF]">{error}</span>}
        </div>
      </div>

      {exemptions.length > 0 && (
        <div className="mt-8">
          <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">Verification exemptions</p>
          <p className="mt-1 text-[13px] text-[#918E86]">
            One-time codes sent to opted-out numbers under the transactional exemption. Logged for audit; nothing to do.
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-[#2E2C28]">
            <ul className="divide-y divide-[#2E2C28]">
              {exemptions.slice(0, 20).map((e, i) => (
                <li key={i} className="flex items-center gap-3 bg-[#0F0E0C] px-5 py-2.5">
                  <span className={`text-[13px] text-[#EFEEEC] ${CONSOLE_MONO}`}>{e.phone}</span>
                  <span className="text-[12px] text-[#918E86]">{e.reason}</span>
                  <span className="ml-auto text-[12px] text-[#5C5A55]">{relativeTime(new Date(e.at).toISOString())}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
