'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { DocsSearchEntry } from '@/lib/dev-docs/docs-search';

const MONO =
  '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';

interface Result {
  href: string;
  title: string;
  trail: string | null;
  snippet: string | null;
  score: number;
}

function snippetAround(text: string, q: string, radius = 56): string {
  const at = text.toLowerCase().indexOf(q);
  if (at < 0) return text.slice(0, radius * 2);
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + q.length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

function search(index: DocsSearchEntry[], query: string): Result[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return index.map((e) => ({
      href: e.href,
      title: e.title,
      trail: null,
      snippet: e.description,
      score: 0,
    }));
  }
  const results: Result[] = [];
  for (const e of index) {
    if (e.title.toLowerCase().includes(q)) {
      results.push({ href: e.href, title: e.title, trail: null, snippet: e.description, score: e.title.toLowerCase().startsWith(q) ? 5 : 4 });
    } else if (e.description.toLowerCase().includes(q)) {
      results.push({ href: e.href, title: e.title, trail: null, snippet: e.description, score: 3 });
    }
    for (const s of e.sections) {
      const headingHit = s.heading && s.heading.toLowerCase().includes(q);
      const textHit = s.text.toLowerCase().includes(q);
      if (!headingHit && !textHit) continue;
      results.push({
        href: s.anchor ? `${e.href}#${s.anchor}` : e.href,
        title: s.heading || e.title,
        trail: e.title,
        snippet: textHit ? snippetAround(s.text, q) : s.text.slice(0, 112),
        score: headingHit ? 2 : 1,
      });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 10);
}

export default function DocsCommandK({ index }: { index: DocsSearchEntry[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [isMac, setIsMac] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const router = useRouter();

  const results = useMemo(() => search(index, query), [index, query]);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => setSelected(0), [query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
      const hash = href.split('#')[1];
      if (hash) {
        setTimeout(() => {
          document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 350);
      }
    },
    [router]
  );

  const onDialogKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && results[selected]) {
      e.preventDefault();
      go(results[selected].href);
    }
  };

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search docs"
        className="flex items-center gap-2 rounded-full border border-[#2E2C28] px-3.5 py-1.5 text-[13px] text-[#918E86] transition-colors duration-150 hover:border-[#918E86] hover:text-[#EFEEEC]"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search docs</span>
        <kbd
          className={`hidden rounded border border-[#2C2C2E] bg-[#1C1C1E] px-1.5 py-px text-[11px] text-[#8E8E93] sm:inline ${MONO}`}
        >
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Search documentation"
        >
          <div
            className="mx-auto mt-[10vh] w-[calc(100%-32px)] max-w-xl overflow-hidden rounded-xl border border-[#2E2C28] bg-[#0F0E0C] shadow-2xl"
            onKeyDown={onDialogKey}
          >
            <div className="flex items-center gap-3 border-b border-[#2E2C28] px-4">
              <Search className="h-4 w-4 flex-shrink-0 text-[#8E8E93]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the docs…"
                className="w-full bg-transparent py-3.5 text-[15px] text-[#F2F2F7] placeholder-[#8E8E93] outline-none"
              />
            </div>

            {results.length > 0 ? (
              <ul ref={listRef} className="max-h-[46vh] overflow-y-auto py-2">
                {results.map((r, i) => (
                  <li key={`${r.href}-${i}`} data-index={i}>
                    <button
                      onClick={() => go(r.href)}
                      onMouseMove={() => setSelected(i)}
                      className={`block w-full px-4 py-2.5 text-left transition-colors duration-100 ${
                        i === selected ? 'bg-[#1C1C1E]' : ''
                      }`}
                    >
                      <p className="text-[14px] text-[#EFEEEC]">
                        {r.title}
                        {r.trail && (
                          <span className="ml-2 text-[12px] text-[#5C5A55]">
                            {r.trail}
                          </span>
                        )}
                      </p>
                      {r.snippet && (
                        <p className="mt-0.5 truncate text-[12px] text-[#918E86]">
                          {r.snippet}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-8 text-center text-[14px] text-[#918E86]">
                No results for &ldquo;{query}&rdquo;
              </p>
            )}

            <div className="flex items-center gap-4 border-t border-[#2E2C28] px-4 py-2 text-[11px] text-[#5C5A55]">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span>esc close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
