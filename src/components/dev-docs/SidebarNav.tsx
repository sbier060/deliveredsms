'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const GUIDE_LINKS = [
  { href: '/docs/quickstart', label: 'Quickstart' },
  { href: '/docs/authentication', label: 'Authentication' },
  { href: '/docs/sandbox', label: 'Sandbox & test numbers' },
  { href: '/docs/pricing', label: 'Pricing' },
  { href: '/docs/migrate-from-twilio', label: 'Migrate from Twilio' },
];

const API_LINKS = [
  { href: '/docs/messages', label: 'Messages' },
  { href: '/docs/verify', label: 'Verify' },
  { href: '/docs/numbers', label: 'Numbers' },
  { href: '/docs/lookup', label: 'Lookup' },
  { href: '/docs/webhooks', label: 'Webhooks' },
  { href: '/docs/errors', label: 'Errors' },
];

const PLATFORM_LINKS = [
  { href: '/docs/inbox', label: 'Inbox & conversations' },
  { href: '/docs/contacts', label: 'Contacts' },
  { href: '/docs/teams', label: 'Teams' },
  { href: '/docs/broadcasts', label: 'Broadcasts' },
  { href: '/docs/scheduled', label: 'Scheduled messages' },
  { href: '/docs/auto-reply', label: 'Auto-replies' },
  { href: '/docs/opt-out', label: 'Opt-out & consent' },
  { href: '/docs/porting', label: 'Number porting' },
];

const RESOURCE_LINKS = [
  { href: '/docs/changelog', label: 'Changelog' },
  { href: '/api/v1/openapi.yaml', label: 'openapi.yaml' },
  { href: '/api/v1/openapi.json', label: 'openapi.json' },
  { href: '/docs/llms-full.txt', label: 'llms-full.txt' },
  { href: '/console', label: 'Console' },
];

function Group({
  title,
  links,
  pathname,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
  pathname: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.12em] text-[#918E86]">
        {title}
      </p>
      <ul className="mt-2 space-y-0.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={`block rounded-lg px-2.5 py-1.5 text-[14px] transition-colors duration-150 ${
                pathname === link.href
                  ? 'bg-[#0F0E0C] text-[#EFEEEC]'
                  : 'text-[#918E86] hover:text-[#C9C6BF]'
              }`}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SidebarNav() {
  const pathname = usePathname() || '';
  return (
    <nav className="space-y-6">
      <Group title="Guides" links={GUIDE_LINKS} pathname={pathname} />
      <Group title="API" links={API_LINKS} pathname={pathname} />
      <Group title="Platform" links={PLATFORM_LINKS} pathname={pathname} />
      <Group title="Resources" links={RESOURCE_LINKS} pathname={pathname} />
    </nav>
  );
}
