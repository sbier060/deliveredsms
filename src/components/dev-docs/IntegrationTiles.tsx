'use client';

import { useEffect, useState } from 'react';
import { BRAND_ICONS } from './brand-icons';
import { LANG_STORAGE, LANG_EVENT } from './CodeTabs';

/** Tile id -> CodeTabs snippet key. Order is display order. */
const TILES: Array<{ icon: keyof typeof BRAND_ICONS; lang: string }> = [
  { icon: 'nodejs', lang: 'Node.js' },
  { icon: 'python', lang: 'Python' },
  { icon: 'ruby', lang: 'Ruby' },
  { icon: 'go', lang: 'Go' },
  { icon: 'curl', lang: 'cURL' },
  { icon: 'cli', lang: 'CLI' },
  { icon: 'mcp', lang: 'MCP' },
];

/**
 * Resend-style icon tile row. Selecting a tile drives every CodeTabs on the
 * page through the same localStorage + event channel CodeTabs already uses.
 */
export default function IntegrationTiles() {
  const [active, setActive] = useState('Node.js');

  useEffect(() => {
    const read = () => {
      const l = localStorage.getItem(LANG_STORAGE);
      if (l && TILES.some((t) => t.lang === l)) setActive(l);
    };
    read();
    window.addEventListener(LANG_EVENT, read);
    return () => window.removeEventListener(LANG_EVENT, read);
  }, []);

  const pick = (lang: string) => {
    setActive(lang);
    try {
      localStorage.setItem(LANG_STORAGE, lang);
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event(LANG_EVENT));
  };

  return (
    <div className="flex flex-wrap items-start justify-center gap-x-3 gap-y-5 sm:gap-x-4">
      {TILES.map(({ icon, lang }, i) => {
        const meta = BRAND_ICONS[icon];
        const isActive = active === lang;
        return (
          <button
            key={lang}
            onClick={() => pick(lang)}
            aria-label={`Show the ${meta.title} example`}
            aria-pressed={isActive}
            className="integration-tile group flex w-[72px] flex-col items-center gap-2 sm:w-[80px]"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition-[border-color,transform,box-shadow] duration-200 ease-out-strong motion-safe:group-hover:-translate-y-0.5 motion-safe:group-active:translate-y-0 motion-safe:group-active:scale-[0.97] sm:h-16 sm:w-16 ${
                isActive
                  ? 'border-[#00D26A] bg-[#0F0E0C] shadow-[0_0_24px_-6px_rgba(0,210,106,0.45)]'
                  : 'border-[#2E2C28] bg-[#0F0E0C] group-hover:border-[#918E86]'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className={`h-7 w-7 transition-colors duration-200 ${
                  isActive ? 'fill-[#00D26A]' : 'fill-[#918E86] group-hover:fill-[#EFEEEC]'
                }`}
              >
                <path d={meta.path} />
              </svg>
            </span>
            <span
              className={`text-[13px] transition-colors duration-200 ${
                isActive ? 'text-[#EFEEEC]' : 'text-[#918E86] group-hover:text-[#C9C6BF]'
              }`}
            >
              {meta.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
