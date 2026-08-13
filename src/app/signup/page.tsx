import type { Metadata } from 'next';
import Link from 'next/link';
import { generateMetadata as buildMetadata } from '@/lib/metadata';
import DevFooter from '@/components/dev-docs/DevFooter';
import { FREE_TIER } from '@/lib/api/pricing';

// Indexable landing for "create a Delivered account" style queries, and one of
// the primary nav destinations in the site schema. Free-tier numbers come from
// the pricing module so this page cannot promise something billing does not.
export const metadata: Metadata = buildMetadata({
  title: 'Create a Delivered account',
  description:
    'Create a free Delivered account and get a sandbox API key and test number instantly. No credit card, no sales call. Send your first SMS in under five minutes.',
  path: '/signup',
  keywords: ['delivered sms signup', 'free sms api', 'sms api sandbox key'],
});

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <header className="border-b border-[#2E2C28]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[24px] text-[#EFEEEC]">Delivered<span className="text-[#00D26A]">.</span></span>
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86]"
          >
            Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-24 pt-16">
        <h1 className="mb-4 text-[32px] leading-tight text-[#EFEEEC]">
          Create a Delivered account
        </h1>
        <p className="mb-8 text-[16px] leading-relaxed text-[#918E86]">
          Free, no credit card, no sales call. You get a sandbox API key and a
          test number the moment you sign up, and every endpoint works against
          the sandbox so you can build the whole integration before going live.
        </p>

        <Link
          href="/console"
          className="inline-flex rounded-full bg-[#00D26A] px-6 py-3 text-[15px] font-medium text-[#0A0A0B] transition-opacity duration-150 hover:opacity-90"
        >
          Sign up free
        </Link>

        <div className="mt-12 border-t border-[#2E2C28] pt-8">
          <h2 className="mb-4 text-[18px] text-[#EFEEEC]">What you get</h2>
          <ul className="space-y-3 text-[15px] leading-relaxed text-[#918E86]">
            <li>A sandbox API key, valid immediately.</li>
            <li>A test number in the reserved +1 500-555 range.</li>
            <li>
              {FREE_TIER.outboundSmsPerMonth} texts and{' '}
              {FREE_TIER.verificationsPerMonth} verifications a month on the free
              tier.
            </li>
            <li>Full API surface in test mode, webhooks included.</li>
          </ul>
        </div>

        <div className="mt-10 border-t border-[#2E2C28] pt-8">
          <h2 className="mb-3 text-[18px] text-[#EFEEEC]">Going live</h2>
          <p className="text-[15px] leading-relaxed text-[#918E86]">
            Live keys are enabled after a short early-access review, so build
            against the sandbox first. Pricing is usage-based with no platform
            fee: see{' '}
            <Link href="/pricing" className="text-[#00D26A] hover:underline">
              Pricing
            </Link>{' '}
            and start with the{' '}
            <Link href="/docs/quickstart" className="text-[#00D26A] hover:underline">
              Quickstart
            </Link>
            .
          </p>
        </div>
      </main>

      <DevFooter />
    </div>
  );
}
