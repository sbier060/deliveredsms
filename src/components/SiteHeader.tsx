import Link from 'next/link';
import Wordmark from '@/components/Wordmark';
import SiteNavMenus from '@/components/SiteNavMenus';
import { HEADER_CTA } from '@/lib/cta';

/**
 * Shared marketing header: wordmark + Resend-style dropdown nav.
 * The plain Pricing / Log in links and the /docs trigger keep the markup in
 * agreement with SITE_NAV in site-schema.ts (sitelinks need real anchors).
 */
export default function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="border-b border-[#2E2C28]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-6">
          <SiteNavMenus />
          <Link
            href="/pricing"
            className="hover-underline-gradient hidden text-[14px] text-[#918E86] transition-colors duration-150 hover:text-[#EFEEEC] sm:block"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="hover-underline-gradient hidden text-[14px] text-[#918E86] transition-colors duration-150 hover:text-[#EFEEEC] sm:block"
          >
            Log in
          </Link>
          {children}
          <Link href="/console" className={HEADER_CTA}>
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
