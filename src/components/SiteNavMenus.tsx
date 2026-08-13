'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { BRAND_ICONS } from './dev-docs/brand-icons';

interface MenuLink {
  href: string;
  label: string;
  desc?: string;
}

const PRODUCT: MenuLink[] = [
  { href: '/#send-receive', label: 'Send & receive', desc: 'Two-way SMS with webhooks' },
  { href: '/#numbers', label: 'Phone numbers', desc: '200+ US & Canada area codes' },
  { href: '/#verify', label: 'Verify', desc: 'OTP codes, billed on success' },
  { href: '/#inbox', label: 'Inbox & teams', desc: 'Shared conversations with roles' },
  { href: '/#broadcasts', label: 'Broadcasts & scheduled', desc: 'Lists, merge fields, send later' },
  { href: '/#opt-out', label: 'Opt-out compliance', desc: 'STOP/START/HELP handled' },
  { href: '/#events', label: 'Webhooks & events', desc: 'Signed, retried, replayable' },
];

const DOCS_LEFT: MenuLink[] = [
  { href: '/docs/quickstart', label: 'Getting started' },
  { href: '/docs/messages', label: 'API reference' },
  { href: '/agents', label: 'Integrations' },
  { href: '/docs/inbox', label: 'Platform' },
  { href: '/docs/changelog', label: 'Changelog' },
];

/** Icon-only grid, Resend-style: 4 columns of muted glyphs. */
const DOCS_ICONS: Array<{ icon: string; href: string }> = [
  { icon: 'nodejs', href: '/docs/quickstart' },
  { icon: 'typescript', href: '/docs/quickstart' },
  { icon: 'python', href: '/docs/quickstart' },
  { icon: 'ruby', href: '/docs/quickstart' },
  { icon: 'go', href: '/docs/quickstart' },
  { icon: 'curl', href: '/docs/messages' },
  { icon: 'cli', href: '/docs/quickstart' },
  { icon: 'mcp', href: '/agents' },
  { icon: 'claude', href: '/claude' },
  { icon: 'anthropic', href: '/claude-code' },
  { icon: 'cursor', href: '/cursor' },
  { icon: 'copilot', href: '/copilot' },
];

const RESOURCES: MenuLink[] = [
  { href: '/pricing', label: 'Pricing & calculator', desc: 'Rates vs Twilio, Telnyx, Plivo' },
  { href: '/docs/migrate-from-twilio', label: 'Migrate from Twilio', desc: 'Endpoint-by-endpoint map' },
  { href: '/agents', label: 'For AI agents', desc: 'MCP server, skills, llms.txt' },
  { href: '/openapi.json', label: 'OpenAPI spec', desc: 'Machine-readable endpoints' },
  { href: '/llms.txt', label: 'llms.txt', desc: 'The whole product for LLMs' },
  { href: 'mailto:support@deliveredsms.com', label: 'Support', desc: 'A human reads every email' },
];

function Item({ link, onNavigate }: { link: MenuLink; onNavigate: () => void }) {
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className="block rounded-lg px-3 py-2 transition-colors duration-100 hover:bg-[#1C1C1E]"
    >
      <span className="block text-[14px] text-[#EFEEEC]">{link.label}</span>
      {link.desc && (
        <span className="mt-0.5 block text-[12px] leading-snug text-[#918E86]">
          {link.desc}
        </span>
      )}
    </Link>
  );
}

export default function SiteNavMenus() {
  const [open, setOpen] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const show = (id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(id);
  };
  const scheduleHide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), 120);
  };
  const close = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, []);

  const trigger = (id: string, label: string, href: string) => (
    <Link
      href={href}
      aria-haspopup="true"
      aria-expanded={open === id}
      onMouseEnter={() => show(id)}
      onFocus={() => show(id)}
      onClick={close}
      className={`hover-underline-gradient flex items-center gap-1 text-[14px] transition-colors duration-150 ${
        open === id ? 'text-[#EFEEEC]' : 'text-[#918E86] hover:text-[#EFEEEC]'
      }`}
    >
      {label}
      <ChevronDown
        className={`h-3.5 w-3.5 transition-transform duration-200 ease-out-strong ${
          open === id ? 'rotate-180' : ''
        }`}
        aria-hidden="true"
      />
    </Link>
  );

  // Enter 200ms, exit 100ms (exit faster than enter); panels scale from the
  // trigger edge, and all movement is motion-safe so reduced-motion keeps a
  // pure fade.
  const panelClass = (id: string, extra: string) =>
    `absolute left-1/2 top-full z-40 -translate-x-1/2 pt-3 origin-top transition-[opacity,transform] ease-out-strong ${
      open === id
        ? 'pointer-events-auto opacity-100 duration-200 motion-safe:translate-y-0 motion-safe:scale-100'
        : 'pointer-events-none opacity-0 duration-100 motion-safe:-translate-y-1 motion-safe:scale-[0.98]'
    } ${extra}`;

  return (
    <div ref={rootRef} className="hidden items-center gap-6 sm:flex">
      {/* Product */}
      <div className="relative" onMouseLeave={scheduleHide} onMouseEnter={() => show('product')}>
        {trigger('product', 'Product', '/')}
        <div className={panelClass('product', 'w-[560px]')} aria-hidden={open !== 'product'}>
          <div className="grid grid-cols-2 gap-1 rounded-[24px] border border-[#2E2C28] bg-[#0F0E0C]/90 p-4 shadow-2xl backdrop-blur-xl">
            {PRODUCT.map((l) => (
              <Item key={l.href} link={l} onNavigate={close} />
            ))}
          </div>
        </div>
      </div>

      {/* Docs - left text list + icon-only grid, per the Resend anatomy */}
      <div className="relative" onMouseLeave={scheduleHide} onMouseEnter={() => show('docs')}>
        {trigger('docs', 'Docs', '/docs')}
        <div className={panelClass('docs', 'w-[560px]')} aria-hidden={open !== 'docs'}>
          <div className="flex gap-10 rounded-[24px] border border-[#2E2C28] bg-[#0F0E0C]/90 p-7 shadow-2xl backdrop-blur-xl">
            <div className="flex min-w-[190px] flex-col">
              {DOCS_LEFT.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={close}
                  className="py-2.5 text-[17px] text-[#C9C6BF] transition-colors duration-150 hover:text-white"
                >
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="grid flex-1 grid-cols-4 content-start gap-y-3">
              {DOCS_ICONS.map(({ icon, href }) => {
                const meta = BRAND_ICONS[icon];
                return (
                  <Link
                    key={icon}
                    href={href}
                    onClick={close}
                    aria-label={meta.title}
                    title={meta.title}
                    className="group flex h-11 w-11 items-center justify-center justify-self-center"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-7 w-7 fill-[#6E6C66] transition-colors duration-150 group-hover:fill-[#EFEEEC]"
                    >
                      <path d={meta.path} />
                    </svg>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Resources */}
      <div className="relative" onMouseLeave={scheduleHide} onMouseEnter={() => show('resources')}>
        {trigger('resources', 'Resources', '/docs/changelog')}
        <div className={panelClass('resources', 'w-[320px]')} aria-hidden={open !== 'resources'}>
          <div className="rounded-[24px] border border-[#2E2C28] bg-[#0F0E0C]/90 p-4 shadow-2xl backdrop-blur-xl">
            {RESOURCES.map((l) => (
              <Item key={l.href} link={l} onNavigate={close} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
