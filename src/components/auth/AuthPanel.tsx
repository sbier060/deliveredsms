'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
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
  // Email-OTP second factor for password sign-ins (see /api/auth/mfa/*).
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const awaitingOtp = useRef(false);

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

  /**
   * Second-factor gate for password sessions. Called with a fresh ID token
   * after any sign-in (and for already-signed-in visitors): asks the server
   * whether this sign-in still needs the emailed code. Returns true when the
   * OTP step is now showing (caller must not redirect).
   */
  const startOtpIfRequired = async (token: string): Promise<boolean> => {
    if (awaitingOtp.current) return true;
    try {
      const res = await fetch('/api/auth/mfa/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { required?: boolean };
      if (!data.required) return false;
      awaitingOtp.current = true;
      setOtpStep(true);
      setOtpCode('');
      void requestOtpCode(token);
      return true;
    } catch {
      // A status-check outage must not strand the user at a dead form.
      return false;
    }
  };

  const requestOtpCode = async (token: string) => {
    setOtpNotice(null);
    try {
      const res = await fetch('/api/auth/mfa/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { status?: string; error?: string };
      if (data.status === 'sent') setOtpNotice('We emailed you a 6-digit code.');
      else if (data.status === 'cooldown') setOtpNotice('A code was just sent - check your email.');
      else if (data.status === 'already_verified' || data.status === 'unavailable') {
        awaitingOtp.current = false;
        setOtpStep(false);
        if (!stayOnPage) router.replace('/console');
      } else setOtpNotice('Could not send the code. Use "Resend code" to try again.');
    } catch {
      setOtpNotice('Could not send the code. Use "Resend code" to try again.');
    }
  };

  const submitOtp = async () => {
    const user = auth.currentUser;
    if (!user) {
      awaitingOtp.current = false;
      setOtpStep(false);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode }),
      });
      if (res.ok) {
        awaitingOtp.current = false;
        setOtpStep(false);
        if (!stayOnPage) router.replace('/console');
        return;
      }
      const data = (await res.json()) as { error?: string };
      const messages: Record<string, string> = {
        invalid: 'That code is not right. Check the latest email and try again.',
        invalid_format: 'Enter the 6-digit code from the email.',
        expired: 'That code expired. Use "Resend code" to get a new one.',
        too_many_attempts: 'Too many tries. Use "Resend code" to get a new one.',
        no_challenge: 'Use "Resend code" to get a new one.',
      };
      setError(messages[data.error || ''] || 'Verification failed. Try again.');
    } catch {
      setError('Verification failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // Already signed in (or just signed in): the console is the destination -
  // unless the host page owns the next step (invite accept), or the session
  // still owes the email-OTP second factor.
  useEffect(() => {
    if (stayOnPage) return;
    return onAuthStateChanged(auth, async (user) => {
      if (!user || awaitingOtp.current) return;
      const token = await user.getIdToken();
      if (await startOtpIfRequired(token)) return;
      router.replace('/console');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Password sign-ins owe the email-OTP second factor. The auth-state
      // effect covers the redirect flow; this covers stayOnPage hosts too.
      const current = auth.currentUser;
      if (current) {
        await startOtpIfRequired(await current.getIdToken());
      }
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

  if (otpStep) {
    return (
      <div className="mt-8 space-y-5">
        <div>
          <p className="text-[15px] font-medium text-[#EFEEEC]">Check your email</p>
          <p className="mt-1 text-[13px] leading-[1.6] text-[#918E86]">
            Enter the 6-digit verification code we sent to{' '}
            <span className="text-[#C9C6BF]">{auth.currentUser?.email || 'your email'}</span>.
          </p>
        </div>
        <div>
          <label htmlFor="auth-otp" className={LABEL}>
            Verification code
          </label>
          <input
            id="auth-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && otpCode.length === 6 && submitOtp()}
            placeholder="123456"
            className={`${INPUT} tracking-[6px]`}
            autoFocus
          />
        </div>
        <button
          onClick={submitOtp}
          disabled={busy || otpCode.length !== 6}
          className={`${PRIMARY_CTA} w-full disabled:pointer-events-none disabled:opacity-30`}
        >
          Verify
        </button>
        <div className="flex items-center justify-between text-[13px]">
          <button
            onClick={async () => {
              const user = auth.currentUser;
              if (user) void requestOtpCode(await user.getIdToken());
            }}
            disabled={busy}
            className="text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
          >
            Resend code
          </button>
          <button
            onClick={async () => {
              awaitingOtp.current = false;
              setOtpStep(false);
              setOtpCode('');
              setError(null);
              await signOut(auth);
            }}
            disabled={busy}
            className="text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
          >
            Use a different account
          </button>
        </div>
        {otpNotice && <p className="text-[13px] leading-[1.6] text-[#918E86]">{otpNotice}</p>}
        {error && <p className="text-[13px] leading-[1.6] text-[#C9C6BF]">{error}</p>}
      </div>
    );
  }

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
