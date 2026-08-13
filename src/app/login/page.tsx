import type { Metadata } from 'next';
import Link from 'next/link';
import { generateMetadata as buildMetadata } from '@/lib/metadata';
import DevFooter from '@/components/dev-docs/DevFooter';

// Indexable landing for "delivered login" style queries, and one of the primary
// nav destinations in the site schema. The console itself is noindex (it is
// behind auth), so without this page the section is invisible to search.
export const metadata: Metadata = buildMetadata({
  title: 'Log in',
  description:
    'Log in to Delivered to manage your API keys, phone numbers, webhooks, and usage. Do not have an account? Create one free, no card required.',
  path: '/login',
  keywords: ['delivered login', 'delivered sms login', 'sms api console'],
});

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <header className="border-b border-[#2E2C28]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[24px] text-[#EFEEEC]">Delivered<span className="text-[#00D26A]">.</span></span>
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86]"
          >
            Create an account
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
        <h1 className="mb-4 text-[32px] leading-tight text-[#EFEEEC]">Log in to Delivered</h1>
        <p className="mb-8 text-[16px] leading-relaxed text-[#918E86]">
          The console is where you manage API keys, phone numbers, webhooks, and
          usage. Sign in with Google or with the email and password on your
          account.
        </p>

        <Link
          href="/console"
          className="inline-flex rounded-full bg-[#00D26A] px-6 py-3 text-[15px] font-medium text-[#0A0A0B] transition-opacity duration-150 hover:opacity-90"
        >
          Continue to the console
        </Link>

        <div className="mt-12 border-t border-[#2E2C28] pt-8">
          <h2 className="mb-3 text-[18px] text-[#EFEEEC]">Do not have an account?</h2>
          <p className="mb-4 text-[15px] leading-relaxed text-[#918E86]">
            Signing up is free and takes about a minute. You get a sandbox API
            key and a test number immediately, with no card required.
          </p>
          <Link href="/signup" className="text-[15px] text-[#00D26A] hover:underline">
            Create a Delivered account
          </Link>
        </div>

        <div className="mt-10 border-t border-[#2E2C28] pt-8">
          <h2 className="mb-3 text-[18px] text-[#EFEEEC]">Lost your API key?</h2>
          <p className="text-[15px] leading-relaxed text-[#918E86]">
            Keys are stored hashed and cannot be displayed again after they are
            minted. Roll the key from the console and the old one is revoked
            immediately. See{' '}
            <Link href="/docs/authentication" className="text-[#00D26A] hover:underline">
              Authentication
            </Link>
            .
          </p>
        </div>
      </main>

      <DevFooter />
    </div>
  );
}
