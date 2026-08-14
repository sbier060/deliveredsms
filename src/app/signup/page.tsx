import type { Metadata } from 'next';
import Link from 'next/link';
import { generateMetadata as buildMetadata } from '@/lib/metadata';
import AuthPanel from '@/components/auth/AuthPanel';
import Wordmark from '@/components/Wordmark';

// Indexable landing for "create a Delivered account" style queries, and one of
// the primary nav destinations in the site schema.
export const metadata: Metadata = buildMetadata({
  title: 'Create a Delivered account',
  description:
    'Create a free Delivered account and get a sandbox API key and test number instantly. No credit card, no sales call. Send your first SMS in under five minutes.',
  path: '/signup',
  keywords: ['delivered sms signup', 'free sms api', 'sms api sandbox key'],
});

export default function SignupPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#0A0A0B] text-white">
      <Link
        href="/"
        className="absolute left-6 top-6 flex items-center gap-1 text-[13px] font-medium text-[#918E86] transition-colors duration-150 hover:text-[#EFEEEC]"
      >
        <span aria-hidden="true">‹</span> Home
      </Link>

      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-6 py-24">
        <div className="text-center">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <h1 className="mt-6 text-[26px] leading-tight text-[#EFEEEC]">
            Create a Delivered account
          </h1>
          <p className="mt-2 text-[14px] text-[#918E86]">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-[#00D26A] hover:underline">
              Log in
            </Link>
            .
          </p>
          <p className="mt-2 text-[13px] text-[#918E86]">
            Free, no card. You get a sandbox API key and a test number the
            moment you sign up.
          </p>
        </div>

        <AuthPanel mode="signup" />

        <p className="mt-8 text-center text-[12px] leading-[1.6] text-[#918E86]">
          By signing up, you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-[#C9C6BF]">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-[#C9C6BF]">
            Privacy Policy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
