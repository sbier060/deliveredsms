'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getConsentStatus, setConsentStatus } from '@/lib/consent';

export default function PrivacyChoicesPage() {
  const [status, setStatus] = useState<'accepted' | 'declined' | 'pending'>('pending');
  useEffect(() => setStatus(getConsentStatus()), []);

  const choose = (s: 'accepted' | 'declined') => {
    setConsentStatus(s);
    setStatus(s);
    window.dispatchEvent(new Event('consent-updated'));
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <header className="border-b border-[#2E2C28]">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
          <Link href="/" className="text-[24px] text-[#EFEEEC]">Delivered<span className="text-[#00D26A]">.</span></Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-[28px] text-[#EFEEEC]">Privacy choices</h1>
        <p className="mt-4 text-[15px] leading-[1.65] text-[#C9C6BF]">
          Control non-essential analytics on this site. Essential cookies for
          authentication and security are always on. Current preference:{' '}
          <span className="text-[#EFEEEC]">{status === 'pending' ? 'not set (analytics off in consent-required regions)' : status}</span>.
        </p>
        <div className="mt-8 flex gap-4">
          <button onClick={() => choose('accepted')} className="rounded-full bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-6 py-2.5 text-[14px] text-black">
            Accept analytics
          </button>
          <button onClick={() => choose('declined')} className="rounded-full border border-[#2E2C28] px-6 py-2.5 text-[14px] text-[#EFEEEC]">
            Reject all
          </button>
        </div>
        <p className="mt-8 text-[13px] text-[#918E86]">
          Details in the <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link>.
        </p>
      </main>
    </div>
  );
}
