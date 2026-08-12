'use client';

import { useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

const INPUT =
  'w-full rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3.5 py-2.5 text-[14px] text-[#F2F2F7] placeholder-[#8E8E93] outline-none transition-colors duration-150 focus:border-[#00D26A]';

export default function AuthCard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      setError(e instanceof Error ? e.message.replace('Firebase: ', '') : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const emailAuth = async () => {
    setError(null);
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (signInError) {
      const code = (signInError as { code?: string }).code || '';
      if (
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-login-credentials'
      ) {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (createError) {
          setError(
            createError instanceof Error
              ? createError.message.replace('Firebase: ', '')
              : 'Could not create account'
          );
        }
      } else {
        setError(
          signInError instanceof Error
            ? signInError.message.replace('Firebase: ', '')
            : 'Sign-in failed'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-6 pt-16">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[#00D26A]">
        Delivered — Sandbox
      </p>
      <h1 className="mt-4 text-[clamp(26px,4vw,34px)] leading-[1.2] tracking-[-0.02em]">
        <span className="block text-[#EFEEEC]">Get your API key.</span>
        <span className="block text-[#918E86]">
          Free sandbox. No card. ~2 minutes to your first message.
        </span>
      </h1>

      <div className="mt-8 space-y-4">
        <button
          onClick={google}
          disabled={busy}
          className="w-full rounded-full bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-8 py-[13px] text-[15px] text-white transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
        >
          Continue with Google
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#2E2C28]" />
          <span className="text-[12px] text-[#918E86]">or</span>
          <div className="h-px flex-1 bg-[#2E2C28]" />
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className={INPUT}
          autoComplete="email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && emailAuth()}
          placeholder="Password"
          className={INPUT}
          autoComplete="current-password"
        />
        <button
          onClick={emailAuth}
          disabled={busy}
          className="w-full rounded-full border border-[#2E2C28] px-8 py-[12px] text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86] disabled:opacity-30"
        >
          Continue with email
        </button>

        {error && <p className="text-[13px] text-[#C9C6BF]">{error}</p>}

        <p className="pt-2 text-[13px] leading-[1.6] text-[#918E86]">
          New emails get an account automatically. Already use a 400k-download consumer phone app?
          The same login works here.
        </p>
      </div>
    </div>
  );
}
