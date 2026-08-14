'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Wordmark from '@/components/Wordmark';

const NAV: Array<{
  href: string;
  label: string;
  soon?: boolean;
}> = [
  { href: '/console', label: 'Overview' },
  { href: '/console/inbox', label: 'Inbox' },
  { href: '/console/messages', label: 'Messages' },
  { href: '/console/contacts', label: 'Contacts' },
  { href: '/console/broadcasts', label: 'Broadcasts' },
  { href: '/console/scheduled', label: 'Scheduled' },
  { href: '/console/search', label: 'Search' },
  { href: '/console/team', label: 'Team' },
  { href: '/console/numbers', label: 'Numbers' },
  { href: '/console/events', label: 'Events' },
  { href: '/console/keys', label: 'API keys' },
  { href: '/console/webhooks', label: 'Webhooks' },
  { href: '/console/compliance', label: 'Compliance' },
  { href: '/console/usage', label: 'Usage' },
  { href: '/console/billing', label: 'Billing' },
  { href: '/console/settings', label: 'Settings' },
];

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <ul className="space-y-0.5">
      {NAV.map((item) =>
        item.soon ? (
          <li
            key={item.href}
            className="flex cursor-default items-center justify-between rounded-lg px-3 py-1.5 text-[14px] text-[#5C5A55]"
            title="Coming soon"
          >
            {item.label}
            <span className="text-[10px] uppercase tracking-[0.08em]">soon</span>
          </li>
        ) : (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`block rounded-lg px-3 py-1.5 text-[14px] transition-colors duration-150 ${
                pathname === item.href
                  ? 'bg-[#0F0E0C] text-[#EFEEEC]'
                  : 'text-[#918E86] hover:text-[#C9C6BF]'
              }`}
            >
              {item.label}
            </Link>
          </li>
        )
      )}
    </ul>
  );
}

export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname() || '';

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) router.replace('/login');
    });
  }, [router]);

  // Idle timeout: sign console sessions out after 30 minutes of inactivity
  // (stated in our carrier KYC). Any interaction resets the clock; the timer
  // only runs while someone is signed in.
  useEffect(() => {
    if (!user) return;
    const IDLE_MS = 30 * 60 * 1000;
    let timer = window.setTimeout(() => signOut(auth), IDLE_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => signOut(auth), IDLE_MS);
    };
    const events: (keyof DocumentEventMap)[] = ['pointerdown', 'keydown', 'scroll', 'visibilitychange'];
    events.forEach((e) => document.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => document.removeEventListener(e, reset));
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white">
        <div className="mx-auto max-w-5xl px-6 py-24 text-[15px] text-[#918E86]">
          Loading…
        </div>
      </div>
    );
  }

  // The console used to render its own copy of the auth form. The form now
  // lives on /login (and /signup), which are indexable pages, so there is one
  // auth surface instead of two that can drift.
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white">
        <div className="mx-auto max-w-5xl px-6 py-24 text-[15px] text-[#918E86]">
          Redirecting to log in…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0A0A0B] text-white">
      {/* Sidebar (Resend-style) */}
      <aside className="hidden w-[230px] flex-shrink-0 flex-col border-r border-[#2E2C28] md:flex">
        <div className="flex h-full flex-col px-3 py-4">
          <Link href="/" className="flex items-center gap-2 px-3 pb-5">
            <Wordmark size="md" suffix="API" />
          </Link>
          <NavLinks pathname={pathname} />
          <div className="mt-auto border-t border-[#2E2C28] px-3 pt-4">
            <p className="truncate text-[13px] text-[#918E86]" title={user.email || ''}>
              {user.email}
            </p>
            <button
              onClick={() => signOut(auth)}
              className="mt-2 text-[13px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="border-b border-[#2E2C28]">
          <div className="flex items-center justify-between px-6 py-3">
            {/* Mobile nav */}
            <div className="no-scrollbar flex items-center gap-1 overflow-x-auto md:hidden">
              {NAV.filter((n) => !n.soon).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] transition-colors duration-150 ${
                    pathname === item.href
                      ? 'bg-[#0F0E0C] text-[#EFEEEC]'
                      : 'text-[#918E86]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="hidden md:block" />
            <nav className="flex flex-shrink-0 items-center gap-4 pl-4">
              <Link
                href="/docs/quickstart"
                className="hover-underline-gradient text-[14px] text-[#918E86] transition-colors duration-150 hover:text-[#EFEEEC]"
              >
                Docs
              </Link>
            </nav>
          </div>
        </header>
        <main className="px-6 py-8 md:px-10">
          {/* The inbox is a two-pane layout and needs the full width; every
              other page keeps the readable column. */}
          <div className={`mx-auto ${pathname === '/console/inbox' ? 'max-w-none' : 'max-w-3xl'}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
