import Link from 'next/link';
import Image from 'next/image';
import SidebarNav from '@/components/dev-docs/SidebarNav';
import Wordmark from '@/components/Wordmark';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <header className="border-b border-[#2E2C28]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Wordmark size="md" suffix="Docs" />
          </Link>
          <nav className="flex items-center gap-5">
            <Link
              href="/"
              className="hover-underline-gradient hidden text-[14px] text-[#918E86] transition-colors duration-150 hover:text-[#EFEEEC] sm:block"
            >
              Overview
            </Link>
            <Link
              href="/console"
              className="rounded-full border border-[#2E2C28] px-4 py-1.5 text-[13px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86]"
            >
              Console
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-10">
            <SidebarNav />
          </div>
        </aside>
        <main className="min-w-0 pb-24">{children}</main>
      </div>
    </div>
  );
}
