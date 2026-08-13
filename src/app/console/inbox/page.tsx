'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { devFetch, type DevTenant } from '@/lib/dev-console/api';
import { Mixpanel } from '@/lib/mixpanel';
import { PageHeading, EmptyState, relativeTime } from '@/components/dev-console/ConsoleTable';

const MONO = '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';
const INPUT =
  'w-full rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3.5 py-2.5 text-[14px] text-[#F2F2F7] placeholder-[#8E8E93] outline-none transition-colors duration-150 focus:border-[#00D26A]';

interface Conversation {
  key: string;
  ourNumber: string;
  counterparty: string;
  counterpartyName: string | null;
  lastBody: string;
  lastDirection: 'inbound' | 'outbound';
  lastMessageAt: number;
  unreadCount: number;
}

interface ThreadMessage {
  id: string;
  to: string;
  from: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: string;
  test: boolean;
  created_at: string;
  media?: string[];
  sent_by?: string;
}

interface Template { id: string; name: string; body: string }

function fmtPhone(e164: string): string {
  const d = e164.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadMessage[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [numbers, setNumbers] = useState<string[]>([]);
  const [compose, setCompose] = useState('');
  const [newTo, setNewTo] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const threadEnd = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await devFetch<{ conversations: Conversation[] }>('/api/developers/conversations');
      setConversations(res.conversations);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inbox');
    }
  }, []);

  const loadThread = useCallback(async (key: string) => {
    const res = await devFetch<{ data: ThreadMessage[] }>(`/api/developers/conversations/${key}?limit=50`);
    // newest-first from the API; render oldest-first
    setThread([...res.data].reverse());
    void devFetch(`/api/developers/conversations/${key}`, { method: 'POST' });
    setConversations((prev) =>
      prev ? prev.map((c) => (c.key === key ? { ...c, unreadCount: 0 } : c)) : prev
    );
    setTimeout(() => threadEnd.current?.scrollIntoView({ block: 'end' }), 50);
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (!u) return;
        void loadConversations();
        void devFetch<{ templates: Template[] }>('/api/developers/templates').then((r) => setTemplates(r.templates)).catch(() => {});
        void devFetch<{ tenant: DevTenant }>('/api/developers/tenant')
          .then((r) => setNumbers((r.tenant.numbers || []).map((n) => n.phone_number)))
          .catch(() => {});
      }),
    [loadConversations]
  );

  // Light polling keeps the inbox honest while it's open.
  useEffect(() => {
    const t = setInterval(() => {
      void loadConversations();
      if (active) void loadThread(active);
    }, 15000);
    return () => clearInterval(t);
  }, [active, loadConversations, loadThread]);

  const open = (key: string) => {
    setActive(key);
    setThread(null);
    void loadThread(key);
  };

  const send = async () => {
    if (!compose.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const conv = conversations?.find((c) => c.key === active);
      const to = showNew ? newTo : conv?.counterparty;
      const from = showNew ? numbers[0] : conv?.ourNumber;
      if (!to || !from) throw new Error('Pick a recipient.');
      await devFetch('/api/developers/messages/send', {
        method: 'POST',
        body: JSON.stringify({ to, from, body: compose }),
      });
      Mixpanel.track('Inbox Message Sent', { product: 'developer_api' });
      setCompose('');
      setShowNew(false);
      setNewTo('');
      await loadConversations();
      if (active) await loadThread(active);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  };

  if (error && !conversations) return <p className="text-[14px] text-[#C9C6BF]">{error}</p>;
  if (!conversations) return <p className="text-[14px] text-[#918E86]">Loading…</p>;

  const activeConv = conversations.find((c) => c.key === active) || null;

  return (
    <div>
      <div className="flex items-start justify-between">
        <PageHeading title="Inbox" subtitle="Every conversation on your numbers, shared with your team." />
        <button
          onClick={() => { setShowNew((s) => !s); setActive(null); setThread(null); }}
          className="rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86]"
        >
          New message
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* Conversation list */}
        <div className="overflow-hidden rounded-xl border border-[#2E2C28]">
          {conversations.length === 0 ? (
            <div className="p-4">
              <EmptyState message="No conversations yet. Send a message, or simulate an inbound one from the sandbox." />
            </div>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-[#2E2C28] overflow-y-auto">
              {conversations.map((c) => (
                <li key={c.key}>
                  <button
                    onClick={() => open(c.key)}
                    className={`block w-full px-4 py-3 text-left transition-colors duration-150 ${
                      active === c.key ? 'bg-[#141310]' : 'bg-[#0F0E0C] hover:bg-[#141310]'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[14px] text-[#EFEEEC]">
                        {c.counterpartyName || fmtPhone(c.counterparty)}
                      </p>
                      <span className="flex-shrink-0 text-[11px] text-[#918E86]">
                        {relativeTime(new Date(c.lastMessageAt).toISOString())}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] text-[#918E86]">
                        {c.lastDirection === 'outbound' ? 'You: ' : ''}{c.lastBody}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="flex-shrink-0 rounded-full bg-[#00D26A] px-2 py-0.5 text-[11px] font-medium text-[#0A0A0B]">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Thread / composer */}
        <div className="flex min-h-[60vh] flex-col overflow-hidden rounded-xl border border-[#2E2C28] bg-[#0F0E0C]">
          {showNew ? (
            <div className="border-b border-[#2E2C28] p-4">
              <input value={newTo} onChange={(e) => setNewTo(e.target.value)} placeholder="To: +1 (555) 123-4567" className={INPUT} />
              {numbers.length > 0 && (
                <p className="mt-2 text-[12px] text-[#918E86]">Sending from {fmtPhone(numbers[0])}</p>
              )}
            </div>
          ) : activeConv ? (
            <div className="flex items-baseline justify-between border-b border-[#2E2C28] px-4 py-3">
              <p className="text-[15px] text-[#EFEEEC]">
                {activeConv.counterpartyName || fmtPhone(activeConv.counterparty)}
              </p>
              <p className={`text-[12px] text-[#918E86] ${MONO}`}>via {fmtPhone(activeConv.ourNumber)}</p>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-[14px] text-[#918E86]">Pick a conversation, or start a new one.</p>
            </div>
          )}

          {(activeConv || showNew) && (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {thread === null && activeConv ? (
                  <p className="text-[13px] text-[#918E86]">Loading…</p>
                ) : (
                  (thread || []).map((m) => (
                    <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%]">
                        <div
                          className={`rounded-2xl px-4 py-2.5 text-[14px] ${
                            m.direction === 'outbound'
                              ? 'rounded-br-md bg-[#1C1C1E] text-[#EFEEEC]'
                              : 'rounded-bl-md border border-[#2E2C28] text-[#C9C6BF]'
                          }`}
                        >
                          {m.body}
                          {(m.media || []).map((u) => (
                            <a key={u} href={u} target="_blank" rel="noreferrer" className="mt-1 block truncate text-[12px] text-[#00D26A] underline underline-offset-2">
                              {u}
                            </a>
                          ))}
                        </div>
                        <p className={`mt-1 text-[11px] text-[#5C5A55] ${m.direction === 'outbound' ? 'text-right' : ''}`}>
                          {m.direction === 'outbound' && m.sent_by ? `${m.sent_by} · ` : ''}
                          {m.status} · {relativeTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={threadEnd} />
              </div>

              <div className="border-t border-[#2E2C28] p-3">
                {templates.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      const t = templates.find((x) => x.id === e.target.value);
                      if (t) setCompose((c) => (c ? `${c} ${t.body}` : t.body));
                    }}
                    className="mb-2 rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-2.5 py-1.5 text-[12px] text-[#918E86] outline-none"
                  >
                    <option value="">Insert template…</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={compose}
                    onChange={(e) => setCompose(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                    placeholder="Type a message ({{first_name}} merges from the contact)"
                    rows={2}
                    className={`${INPUT} resize-none`}
                  />
                  <button
                    onClick={() => void send()}
                    disabled={busy || !compose.trim()}
                    className="flex-shrink-0 rounded-full bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-6 py-[10px] text-[14px] text-white transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
                  >
                    Send
                  </button>
                </div>
                {error && <p className="mt-2 text-[13px] text-[#C9C6BF]">{error}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
