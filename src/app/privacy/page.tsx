import type { Metadata } from 'next';
import Link from 'next/link';
import { generateMetadata as buildMetadata } from '@/lib/metadata';
import DocsMarkdown from '@/components/dev-docs/DocsMarkdown';
import DevFooter from '@/components/dev-docs/DevFooter';
import { PRIVACY_MD } from '@/lib/legal';

export const metadata: Metadata = buildMetadata({
  title: 'Privacy Policy',
  description: 'How Truelabel LLC (Delivered) collects, uses, and protects data.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <header className="border-b border-[#2E2C28]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[16px] text-[#EFEEEC]">Delivered<span className="text-[#00D26A]">.</span></span>
          </Link>
          <Link href="/console" className="rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86]">
            Console
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
        <article><DocsMarkdown markdown={PRIVACY_MD} /></article>
      </main>
      <DevFooter />
    </div>
  );
}
