'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

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
  { href: '/docs/webhooks', label: 'Webhooks' },
  { href: '/docs/inbox', label: 'Platform' },
  { href: '/docs/sandbox', label: 'Sandbox' },
  { href: '/docs/changelog', label: 'Changelog' },
];

const DOCS_TOOLS: MenuLink[] = [
  { href: '/claude', label: 'Claude' },
  { href: '/claude-code', label: 'Claude Code' },
  { href: '/cursor', label: 'Cursor' },
  { href: '/codex', label: 'Codex' },
  { href: '/devin', label: 'Devin' },
  { href: '/copilot', label: 'GitHub Copilot' },
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
        className={`h-3.5 w-3.5 transition-transform duration-200 ${
          open === id ? 'rotate-180' : ''
        }`}
        aria-hidden="true"
      />
    </Link>
  );

  const panelClass = (id: string, extra: string) =>
    `absolute left-1/2 top-full z-40 -translate-x-1/2 pt-3 transition-[opacity,transform] duration-150 ease-out ${
      open === id
        ? 'pointer-events-auto translate-y-0 opacity-100'
        : 'pointer-events-none -translate-y-1 opacity-0'
    } ${extra}`;

  return (
    <div ref={rootRef} className="hidden items-center gap-6 sm:flex">
      {/* Product */}
      <div className="relative" onMouseLeave={scheduleHide} onMouseEnter={() => show('product')}>
        {trigger('product', 'Product', '/')}
        <div className={panelClass('product', 'w-[560px]')} aria-hidden={open !== 'product'}>
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[#2E2C28] bg-[#0F0E0C]/95 p-2 shadow-2xl backdrop-blur">
            {PRODUCT.map((l) => (
              <Item key={l.href} link={l} onNavigate={close} />
            ))}
          </div>
        </div>
      </div>

      {/* Docs */}
      <div className="relative" onMouseLeave={scheduleHide} onMouseEnter={() => show('docs')}>
        {trigger('docs', 'Docs', '/docs')}
        <div className={panelClass('docs', 'w-[480px]')} aria-hidden={open !== 'docs'}>
          <div className="grid grid-cols-[1fr_auto_1fr] rounded-2xl border border-[#2E2C28] bg-[#0F0E0C]/95 p-2 shadow-2xl backdrop-blur">
            <div>
              {DOCS_LEFT.map((l) => (
                <Item key={l.href} link={l} onNavigate={close} />
              ))}
            </div>
            <div className="mx-2 w-px bg-[#2E2C28]" aria-hidden="true" />
            <div>
              <p className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-[0.1em] text-[#5C5A55]">
                Works with
              </p>
              {DOCS_TOOLS.map((l) => (
                <Item key={l.href} link={l} onNavigate={close} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Resources */}
      <div className="relative" onMouseLeave={scheduleHide} onMouseEnter={() => show('resources')}>
        {trigger('resources', 'Resources', '/docs/changelog')}
        <div className={panelClass('resources', 'w-[320px]')} aria-hidden={open !== 'resources'}>
          <div className="rounded-2xl border border-[#2E2C28] bg-[#0F0E0C]/95 p-2 shadow-2xl backdrop-blur">
            {RESOURCES.map((l) => (
              <Item key={l.href} link={l} onNavigate={close} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
