'use client';

import { useEffect, useRef, useState } from 'react';

const MONO =
  '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';

/** Fake feed - real event names, masked numbers, plausible latencies. */
const EVENTS = [
  'message.delivered · +1 (415) •••-••41 · 212ms',
  'number.purchased · +1 (628) •••-••07',
  'message.received · +1 (917) •••-••88',
  'verification.approved · +1 (305) •••-••19 · 1.4s',
  'message.sent · +1 (206) •••-••53 · 98ms',
  'message.opted_out · +1 (512) •••-••74',
  'verification.sent · +1 (773) •••-••02 · 121ms',
  'broadcast.complete · 240 recipients',
];

const VISIBLE = 4;
const ROW_H = 32; // px, fixed so rows can move by transform only
const TICK_MS = 3200;

/**
 * The hero "Live events" card, actually alive: a new event slides in from
 * the top every few seconds and the rest shift down. Rows are absolutely
 * positioned and moved with transform transitions (interruptible, no
 * layout). Paused under prefers-reduced-motion and when the tab is hidden.
 */
export default function LiveEventsCard() {
  // head = index of the newest visible event in EVENTS (wraps).
  const [head, setHead] = useState(0);
  const [animate, setAnimate] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return; // static list, matching the SSR output
    setAnimate(true);
    const tick = () => {
      if (document.hidden) return;
      setHead((h) => (h + 1) % EVENTS.length);
    };
    timer.current = setInterval(tick, TICK_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  return (
    <div className="rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-5">
      <p className="flex items-center gap-2 text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
        <span className="relative flex h-2 w-2">
          {animate && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00D26A] opacity-60 [animation-duration:2.4s]" />
          )}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00D26A]" />
        </span>
        Live events
      </p>
      <ul
        className="relative mt-4 overflow-hidden"
        style={{ height: VISIBLE * ROW_H }}
        aria-live="off"
      >
        {EVENTS.map((text, i) => {
          // Position relative to the head: 0 = newest row. Three states:
          // visible rows sit at pos * ROW_H; the row that just left (pos ==
          // VISIBLE) animates one step further down while fading; everything
          // older parks above the list with NO transition, so its jump back
          // to the entry position never paints.
          const pos = (i - head + EVENTS.length) % EVENTS.length;
          const visible = pos < VISIBLE;
          const exiting = pos === VISIBLE;
          const y = visible ? pos * ROW_H : exiting ? VISIBLE * ROW_H : -ROW_H;
          return (
            <li
              key={text}
              aria-hidden={!visible}
              className={`absolute inset-x-0 top-0 flex items-center truncate text-[13px] text-[#C9C6BF] ${MONO} ${
                animate && (visible || exiting)
                  ? 'transition-[transform,opacity] duration-[400ms] ease-in-out-strong'
                  : ''
              } ${visible ? 'opacity-100' : 'opacity-0'}`}
              style={{ height: ROW_H, transform: `translateY(${y}px)` }}
>
              {text}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
