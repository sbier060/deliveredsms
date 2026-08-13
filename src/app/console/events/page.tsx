'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { devFetch } from '@/lib/dev-console/api';
import {
  CONSOLE_MONO,
  PageHeading,
  EmptyState,
  relativeTime,
} from '@/components/dev-console/ConsoleTable';

interface ApiEvent {
  id: string;
  type: string;
  created_at: string;
  data: Record<string, unknown>;
}

export default function EventsPage() {
  const [events, setEvents] = useState<ApiEvent[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replayed, setReplayed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await devFetch<{ data: ApiEvent[] }>('/api/developers/events?limit=50');
      setEvents(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load events');
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
        title="Events"
        subtitle="Message and number lifecycle events. Webhook delivery of these events is coming soon; poll GET /v1/events meanwhile."
      />
      {error && <p className="text-[14px] text-[#C9C6BF]">{error}</p>}
      {events === null ? (
        <p className="text-[14px] text-[#918E86]">Loading…</p>
      ) : events.length === 0 ? (
        <EmptyState
          message="No events yet."
          ctaHref="/console"
          ctaLabel="Send your first message"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#2E2C28]">
          <ul className="divide-y divide-[#2E2C28]">
            {events.map((e) => (
              <li key={e.id} className="bg-[#0F0E0C]">
                <button
                  onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-[#141310]"
                >
                  <span className={`text-[13px] text-[#EFEEEC] ${CONSOLE_MONO}`}>
                    {e.type}
                  </span>
                  <span className={`truncate text-[12px] text-[#918E86] ${CONSOLE_MONO}`}>
                    {String(e.data.message_id || e.data.phone_number || '')}
                  </span>
                  <span className="ml-auto flex-shrink-0 text-[12px] text-[#918E86]">
                    {relativeTime(e.created_at)}
                  </span>
                </button>
                {expanded === e.id && (
                  <pre
                    className={`overflow-x-auto border-t border-[#2C2C2E] bg-[#111112] p-4 text-[12px] leading-relaxed text-[#918E86] ${CONSOLE_MONO}`}
                  >
                    {JSON.stringify(
                      { id: e.id, object: 'event', type: e.type, created_at: e.created_at, data: e.data },
                      null,
                      2
                    )}
                  </pre>
                )}
                {expanded === e.id && (
                  <div className="border-t border-[#2C2C2E] bg-[#111112] px-4 py-2.5">
                    <button
                      onClick={async () => {
                        setReplayed(null);
                        try {
                          await devFetch(`/api/developers/events/${e.id}/replay`, { method: 'POST' });
                          setReplayed(e.id);
                        } catch {
                          setReplayed('error');
                        }
                      }}
                      className="text-[12px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
                    >
                      Replay to webhooks
                    </button>
                    {replayed === e.id && <span className="ml-3 text-[12px] text-[#00D26A]">Replayed</span>}
                    {replayed === 'error' && <span className="ml-3 text-[12px] text-[#C9C6BF]">Replay failed</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
