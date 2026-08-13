'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

const INPUT =
  'w-full rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3.5 py-2.5 text-[14px] text-[#F2F2F7] placeholder-[#8E8E93] outline-none transition-colors duration-150 focus:border-[#00D26A]';

/**
 * The one auth surface. Lives on /login and /signup so both are real pages that
 * can rank; the console redirects here rather than rendering its own copy.
 *
 * The two modes differ only in what happens to an email that does not match an
 * account: login says so and points at /signup, signup creates it. Previously
 * the console silently created an account on any failed sign-in, which made a
 * typo'd email look like a successful login into an empty tenant.
 */
export default function AuthPanel({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<React.ReactNode>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in (or just signed in): the console is the destination.
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) router.replace('/console');
    });
  }, [router]);

  const clean = (e: unknown, fallback: string) =>
    e instanceof Error ? e.message.replace('Firebase: ', '') : fallback;

  const google = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      setError(clean(e, 'Sign-in failed'));
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
      if (mode === 'signup') {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (createError) {
          // Signing up with an address that already exists is a login.
          if ((createError as { code?: string }).code === 'auth/email-already-in-use') {
            await signInWithEmailAndPassword(auth, email, password);
          } else {
            throw createError;
          }
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      const code = (e as { code?: string }).code || '';
      if (
        mode === 'login' &&
        (code === 'auth/user-not-found' ||
          code === 'auth/invalid-credential' ||
          code === 'auth/invalid-login-credentials')
      ) {
        setError(
          <>
            No account matches that email and password.{' '}
            <Link href="/signup" className="text-[#00D26A] hover:underline">
              Create an account
            </Link>{' '}
            instead.
          </>
        );
      } else {
        setError(clean(e, mode === 'signup' ? 'Could not create account' : 'Sign-in failed'));
      }
    } finally {
      setBusy(false);
    }
  };

  const isSignup = mode === 'signup';

  return (
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
        autoComplete={isSignup ? 'new-password' : 'current-password'}
      />
      <button
        onClick={emailAuth}
        disabled={busy}
        className="w-full rounded-full border border-[#2E2C28] px-8 py-[12px] text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86] disabled:opacity-30"
      >
        {isSignup ? 'Create account with email' : 'Log in with email'}
      </button>

      {error && <p className="text-[13px] leading-[1.6] text-[#C9C6BF]">{error}</p>}

      {/* Hidden while an error shows: the login error already links to /signup,
          and two "Create an account" links a line apart read as a bug. */}
      <p className={`pt-2 text-[13px] leading-[1.6] text-[#918E86] ${error ? 'hidden' : ''}`}>
        {isSignup ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="text-[#00D26A] hover:underline">
              Log in
            </Link>
            .
          </>
        ) : (
          <>
            New here?{' '}
            <Link href="/signup" className="text-[#00D26A] hover:underline">
              Create an account
            </Link>
            . If you already use the consumer phone app, the same login works.
          </>
        )}
      </p>
    </div>
  );
}
