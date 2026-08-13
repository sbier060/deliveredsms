'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { devFetch } from '@/lib/dev-console/api';
import { CONSOLE_MONO, PageHeading, relativeTime } from '@/components/dev-console/ConsoleTable';

const INPUT =
  'w-full rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3.5 py-2.5 text-[14px] text-[#F2F2F7] placeholder-[#8E8E93] outline-none transition-colors duration-150 focus:border-[#00D26A]';

interface Contact { id: string; name: string; phone: string; digits: string; tags: string[] }
interface Message { id: string; to: string; from: string; body: string; direction: string; created_at: string }
interface Results { contacts: Contact[]; messages: Message[]; scanned_messages: number; window: number }

export default function SearchPage() {
  const params = useSearchParams();
  const [q, setQ] = useState(params?.get('q') || '');
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => setReady(!!u)), []);

  useEffect(() => {
    if (!ready || q.trim().length < 2) { setResults(null); return; }
    const t = setTimeout(() => {
      void devFetch<Results>(`/api/developers/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => { setResults(r); setError(null); })
        .catch((e) => setError(e instanceof Error ? e.message : 'Search failed'));
    }, 350);
    return () => clearTimeout(t);
  }, [q, ready]);

  const convHref = (m: Message) => {
    const ours = (m.direction === 'outbound' ? m.from : m.to).replace(/\D/g, '').slice(-10);
    const theirs = (m.direction === 'outbound' ? m.to : m.from).replace(/\D/g, '').slice(-10);
    return `/console/inbox?open=${ours}_${theirs}`;
  };

  return (
    <div>
      <PageHeading title="Search" subtitle="Contacts by name or number; messages by text." />
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search contacts and messages…"
        className={`${INPUT} mt-6 max-w-lg`}
      />
      {error && <p className="mt-3 text-[13px] text-[#C9C6BF]">{error}</p>}

      {results && (
        <>
          {results.contacts.length > 0 && (
            <div className="mt-6">
              <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">Contacts</p>
              <div className="mt-2 overflow-hidden rounded-xl border border-[#2E2C28]">
                <ul className="divide-y divide-[#2E2C28]">
                  {results.contacts.map((c) => (
                    <li key={c.id} className="flex items-center justify-between bg-[#0F0E0C] px-5 py-3">
                      <span className="text-[14px] text-[#EFEEEC]">{c.name || '—'}</span>
                      <span className={`text-[13px] text-[#918E86] ${CONSOLE_MONO}`}>{c.phone}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {results.messages.length > 0 && (
            <div className="mt-6">
              <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">Messages</p>
              <div className="mt-2 overflow-hidden rounded-xl border border-[#2E2C28]">
                <ul className="divide-y divide-[#2E2C28]">
                  {results.messages.map((m) => (
                    <li key={m.id} className="bg-[#0F0E0C] px-5 py-3">
                      <Link href={convHref(m)} className="block">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className={`text-[13px] text-[#918E86] ${CONSOLE_MONO}`}>
                            {m.direction === 'outbound' ? `to ${m.to}` : `from ${m.from}`}
                          </span>
                          <span className="flex-shrink-0 text-[12px] text-[#5C5A55]">{relativeTime(m.created_at)}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[14px] text-[#C9C6BF]">{m.body}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {results.contacts.length === 0 && results.messages.length === 0 && (
            <p className="mt-6 text-[14px] text-[#918E86]">No matches.</p>
          )}
          <p className="mt-4 text-[12px] text-[#5C5A55]">
            Searched your contacts and the most recent {results.window.toLocaleString()} messages.
          </p>
        </>
      )}
    </div>
  );
}
