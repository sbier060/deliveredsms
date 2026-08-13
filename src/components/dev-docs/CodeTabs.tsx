'use client';

import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { readKeyOnce } from '@/lib/dev-console/key-once';
import {
  API_KEY_PLACEHOLDER,
  FROM_PLACEHOLDER,
  DEFAULT_KEY,
  DEFAULT_FROM,
} from '@/lib/dev-docs/snippets';

const MONO =
  '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';
export const LANG_STORAGE = 'ghost-dev-lang';
export const LANG_EVENT = 'ghost-dev-lang';

function highlight(code: string): string {
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(
    /("[^"\n]*"|'[^'\n]*')/g,
    '<span class="text-[#EFEEEC]">$1</span>'
  );
}

export interface CodeTabsProps {
  snippets: Record<string, string>;
  /** Substitute {{API_KEY}}/{{FROM_NUMBER}} from the session key stash. */
  keyAware?: boolean;
}

/**
 * Language-tabbed code block. The chosen language persists in localStorage
 * and syncs across every CodeTabs on the page.
 */
export default function CodeTabs({ snippets, keyAware = false }: CodeTabsProps) {
  const langs = Object.keys(snippets);
  const [lang, setLang] = useState(langs[0]);
  const [copied, setCopied] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [sessionFrom, setSessionFrom] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(LANG_STORAGE);
    if (stored && langs.includes(stored)) setLang(stored);
    const onLang = () => {
      const l = localStorage.getItem(LANG_STORAGE);
      if (l && langs.includes(l)) setLang(l);
    };
    window.addEventListener(LANG_EVENT, onLang);
    return () => window.removeEventListener(LANG_EVENT, onLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!keyAware) return;
    const { key, sandboxNumber } = readKeyOnce();
    setSessionKey(key);
    setSessionFrom(sandboxNumber);
  }, [keyAware]);

  const pick = (l: string) => {
    setLang(l);
    setCopied(false);
    try {
      localStorage.setItem(LANG_STORAGE, l);
      window.dispatchEvent(new Event(LANG_EVENT));
    } catch {}
  };

  const resolve = (code: string) =>
    code
      .replaceAll(API_KEY_PLACEHOLDER, (keyAware && sessionKey) || DEFAULT_KEY)
      .replaceAll(FROM_PLACEHOLDER, (keyAware && sessionFrom) || DEFAULT_FROM);

  const code = resolve(snippets[lang] ?? '');

  return (
    <div>
      {keyAware && sessionKey && (
        <p className="mb-2 text-[12px] text-[#918E86]">
          <span className="text-[#00D26A]">●</span> Your test key is filled into
          this snippet; treat this page as secret.
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-[#2C2C2E] bg-[#111112]">
        <div className="flex items-center justify-between gap-2 border-b border-[#2C2C2E] bg-[#0A0A0B] px-2 py-1.5">
          <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
            {langs.map((l) => (
              <button
                key={l}
                onClick={() => pick(l)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] transition-colors duration-150 ${
                  l === lang
                    ? 'bg-[#1C1C1E] text-[#EFEEEC]'
                    : 'text-[#8E8E93] hover:text-[#C9C6BF]'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              void copyToClipboard(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-[#8E8E93] transition-all duration-150 hover:bg-[#2C2C2E] hover:text-[#F2F2F7]"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-[#00D26A]" />
                <span className="text-[#00D26A]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
        <pre
          className={`overflow-x-auto p-4 text-[13px] leading-relaxed text-[#918E86] ${MONO}`}
        >
          <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
        </pre>
      </div>
    </div>
  );
}
