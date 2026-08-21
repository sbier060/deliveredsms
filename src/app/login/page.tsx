import type { Metadata } from 'next';
import Link from 'next/link';
import { generateMetadata as buildMetadata } from '@/lib/metadata';
import AuthPanel from '@/components/auth/AuthPanel';
import Wordmark from '@/components/Wordmark';

// Indexable landing for "delivered login" style queries, and one of the primary
// nav destinations in the site schema. The console itself is noindex (it is
// behind auth), so without this page the section is invisible to search.
// The form is the real one: the console redirects here rather than rendering
// its own copy, so there is a single auth surface.
export const metadata: Metadata = buildMetadata({
  title: 'Log in',
  description:
    'Log in to Resms to manage your API keys, phone numbers, webhooks, and usage. Do not have an account? Create one free, no card required.',
  path: '/login',
  keywords: ['resms login', 'delivered login', 'delivered sms login', 'sms api console'],
});

export default function LoginPage() {
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
            Log in to Resms
          </h1>
          <p className="mt-2 text-[14px] text-[#918E86]">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-[#00D26A] hover:underline">
              Sign up
            </Link>
            .
          </p>
        </div>

        <AuthPanel mode="login" />

        <p className="mt-8 text-center text-[12px] leading-[1.6] text-[#918E86]">
          By signing in, you agree to our{' '}
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
