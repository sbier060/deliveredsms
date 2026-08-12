'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { devFetch } from '@/lib/dev-console/api';
import {
  CONSOLE_MONO,
  PageHeading,
  EmptyState,
  StatusPill,
  relativeTime,
} from '@/components/dev-console/ConsoleTable';

interface Message {
  id: string;
  to: string;
  from: string;
  body: string;
  direction: 'outbound' | 'inbound';
  status: string;
  test: boolean;
  created_at: string;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await devFetch<{ data: Message[] }>('/api/developers/messages?limit=50');
      setMessages(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load messages');
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
        title="Messages"
        subtitle="Every message sent or received through your API keys, newest first."
      />
      {error && <p className="text-[14px] text-[#C9C6BF]">{error}</p>}
      {messages === null ? (
        <p className="text-[14px] text-[#918E86]">Loading…</p>
      ) : messages.length === 0 ? (
        <EmptyState
          message="No messages yet."
          ctaHref="/console"
          ctaLabel="Send your first message"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#2E2C28]">
          <ul className="divide-y divide-[#2E2C28]">
            {messages.map((m) => (
              <li key={m.id} className="bg-[#0F0E0C] px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[13px] text-[#EFEEEC] ${CONSOLE_MONO}`}>
                    {m.direction === 'outbound' ? m.to : m.from}
                  </span>
                  <span className="text-[12px] text-[#918E86]">
                    {m.direction === 'outbound' ? 'outbound' : 'inbound'}
                  </span>
                  <StatusPill status={m.status} />
                  {m.test && (
                    <span className="rounded-md border border-[#2C2C2E] px-1.5 py-0.5 text-[11px] text-[#918E86]">
                      test
                    </span>
                  )}
                  <span className="ml-auto text-[12px] text-[#918E86]">
                    {relativeTime(m.created_at)}
                  </span>
                </div>
                <p className="mt-1.5 truncate text-[14px] text-[#C9C6BF]">{m.body}</p>
                <p className={`mt-1 text-[11px] text-[#5C5A55] ${CONSOLE_MONO}`}>{m.id}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
