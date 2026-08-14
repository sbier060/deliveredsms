'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  type AuthProvider,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import GoogleMark from './GoogleMark';
import GithubMark from './GithubMark';
import { PRIMARY_CTA } from '@/lib/cta';

const INPUT =
  'h-11 w-full rounded-xl border border-[#2E2C28] bg-[#0F0E0C] px-3.5 text-[14px] text-[#EFEEEC] placeholder-[#918E86] outline-none transition-colors duration-150 focus:border-[#00D26A]';

const LABEL = 'mb-2 flex items-center gap-2 text-[13px] text-[#918E86]';

const OAUTH_BTN =
  'relative flex h-11 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-xl border border-[#8E918F] bg-[#131314] px-4 text-[14px] font-medium text-[#E3E3E3] transition-colors duration-150 hover:bg-[#1B1B1C] motion-safe:active:scale-[0.99] disabled:opacity-30';

/** Which methods can carry the "Last used" chip. */
type AuthMethod = 'google' | 'github' | 'email';
const LAST_AUTH_KEY = 'delivered-last-auth';

/**
 * Password policy: at least 12 characters with upper- and lowercase letters,
 * a digit, and a special character. Stated in our carrier KYC; keep the
 * Firebase console password policy configured to match so the rule is also
 * enforced server-side, not just here.
 */
const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 12, label: '12+ characters' },
  { test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p), label: 'upper & lower case' },
  { test: (p: string) => /\d/.test(p), label: 'a number' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: 'a special character' },
];
const passwordOk = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

/**
 * Brute-force lockout: after 12 consecutive failed password sign-ins this
 * browser is locked out for 15 minutes (also stated in our carrier KYC).
 * Firebase additionally throttles repeated failures server-side
 * (auth/too-many-requests); this makes the policy explicit and user-visible.
 */
const FAILS_KEY = 'delivered-auth-fails';
const MAX_FAILED_ATTEMPTS = 12;
const LOCKOUT_MS = 15 * 60 * 1000;

type FailState = { count: number; lockedUntil: number };

function readFails(): FailState {
  try {
    const raw = localStorage.getItem(FAILS_KEY);
    if (raw) return JSON.parse(raw) as FailState;
  } catch {
    // Unreadable state counts as clean.
  }
  return { count: 0, lockedUntil: 0 };
}

function writeFails(state: FailState) {
  try {
    localStorage.setItem(FAILS_KEY, JSON.stringify(state));
  } catch {
    // Private mode: Firebase's server-side throttling still applies.
  }
}

// GitHub is fully wired but stays hidden until the provider is enabled in
// Firebase (needs a GitHub OAuth app). Flip NEXT_PUBLIC_GITHUB_AUTH=1 once
// the IdP config exists; shipping the button before that is a dead click.
const GITHUB_ENABLED = process.env.NEXT_PUBLIC_GITHUB_AUTH === '1';

function LastUsedChip() {
  return (
    <span className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-[#2E2C28] bg-[#0F0E0C] px-2 py-0.5 text-[11px] font-medium text-[#C9C6BF]">
      Last used
    </span>
  );
}

/**
 * The one auth surface. Lives on /login and /signup so both are real pages that
 * can rank; the console redirects here rather than rendering its own copy.
 * Resend-style anatomy: OAuth row (with a "Last used" chip over whichever
 * method this browser signed in with most recently), or-divider, labeled
 * email + password, one loud submit button.
 *
 * The two modes differ only in what happens to an email that does not match an
 * account: login says so and points at /signup, signup creates it. Previously
 * the console silently created an account on any failed sign-in, which made a
 * typo'd email look like a successful login into an empty tenant.
 */
export default function AuthPanel({
  mode,
  stayOnPage = false,
}: {
  mode: 'login' | 'signup';
  /** Host page handles the post-auth step itself (the /join flow). */
  stayOnPage?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<React.ReactNode>(null);
  const [busy, setBusy] = useState(false);
  const [lastUsed, setLastUsed] = useState<AuthMethod | null>(null);

  // localStorage is browser-only; read after mount so SSR markup matches.
  useEffect(() => {
    const stored = localStorage.getItem(LAST_AUTH_KEY);
    if (stored === 'google' || stored === 'github' || stored === 'email') {
      setLastUsed(stored);
    }
  }, []);

  const rememberMethod = (method: AuthMethod) => {
    try {
      localStorage.setItem(LAST_AUTH_KEY, method);
    } catch {
      // Private mode: the chip just will not show next time.
    }
  };

  // Already signed in (or just signed in): the console is the destination -
  // unless the host page owns the next step (invite accept).
  useEffect(() => {
    if (stayOnPage) return;
    return onAuthStateChanged(auth, (user) => {
      if (user) router.replace('/console');
    });
  }, [router, stayOnPage]);

  const clean = (e: unknown, fallback: string) =>
    e instanceof Error ? e.message.replace('Firebase: ', '') : fallback;

  const oauth = async (method: 'google' | 'github', provider: AuthProvider) => {
    setError(null);
    setBusy(true);
    try {
      await signInWithPopup(auth, provider);
      rememberMethod(method);
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
    const fails = readFails();
    if (Date.now() < fails.lockedUntil) {
      const minutes = Math.max(1, Math.ceil((fails.lockedUntil - Date.now()) / 60000));
      setError(
        `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
      );
      return;
    }
    if (mode === 'signup' && !passwordOk(password)) {
      setError(
        'Password must be at least 12 characters and include uppercase and lowercase letters, a number, and a special character.'
      );
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
      writeFails({ count: 0, lockedUntil: 0 });
      rememberMethod('email');
    } catch (e) {
      const code = (e as { code?: string }).code || '';
      const isCredentialFailure =
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-login-credentials';
      if (isCredentialFailure) {
        const next = { ...readFails() };
        next.count += 1;
        if (next.count >= MAX_FAILED_ATTEMPTS) {
          next.lockedUntil = Date.now() + LOCKOUT_MS;
          next.count = 0;
        }
        writeFails(next);
        if (next.lockedUntil > Date.now()) {
          setError('Too many failed sign-in attempts. Try again in 15 minutes.');
          setBusy(false);
          return;
        }
      }
      if (mode === 'login' && isCredentialFailure) {
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
  const verb = isSignup ? 'Sign up' : 'Log in';

  return (
    <div className="mt-8 space-y-5">
      <div className={`grid gap-3 ${GITHUB_ENABLED ? 'sm:grid-cols-2' : ''}`}>
        {/* Google's dark-theme sign-in button, to their spec: #131314 surface,
            #8E918F 1px stroke, #E3E3E3 label, their mark at 18px. People scan
            for this exact object; a brand-green pill does not read as
            "sign in with Google". The GitHub button copies the treatment. */}
        <button onClick={() => oauth('google', new GoogleAuthProvider())} disabled={busy} className={OAUTH_BTN}>
          {lastUsed === 'google' && <LastUsedChip />}
          <GoogleMark />
          {verb} with Google
        </button>
        {GITHUB_ENABLED && (
          <button onClick={() => oauth('github', new GithubAuthProvider())} disabled={busy} className={OAUTH_BTN}>
            {lastUsed === 'github' && <LastUsedChip />}
            <GithubMark />
            {verb} with GitHub
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#2E2C28]" />
        <span className="text-[12px] text-[#918E86]">or</span>
        <div className="h-px flex-1 bg-[#2E2C28]" />
      </div>

      <div>
        <label htmlFor="auth-email" className={LABEL}>
          Email
          {lastUsed === 'email' && (
            <span className="rounded-md border border-[#2E2C28] bg-[#0F0E0C] px-1.5 py-px text-[10px] text-[#918E86]">
              Last used
            </span>
          )}
        </label>
        <input
          id="auth-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="alan.turing@example.com"
          className={INPUT}
          autoComplete="email"
        />
      </div>
      <div>
        <label htmlFor="auth-password" className={LABEL}>
          Password
        </label>
        <input
          id="auth-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && emailAuth()}
          placeholder="••••••••"
          className={INPUT}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
        />
        {isSignup && (
          <p className="mt-2 text-[12px] leading-[1.6] text-[#918E86]">
            At least 12 characters, with uppercase and lowercase letters, a
            number, and a special character.
          </p>
        )}
      </div>

      <button
        onClick={emailAuth}
        disabled={busy || !email || !password}
        className={`${PRIMARY_CTA} w-full disabled:pointer-events-none disabled:opacity-30`}
      >
        {isSignup ? 'Create account' : 'Log in'}
      </button>

      {error && <p className="text-[13px] leading-[1.6] text-[#C9C6BF]">{error}</p>}
    </div>
  );
}
