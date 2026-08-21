'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import AuthPanel from '@/components/auth/AuthPanel';
import Wordmark from '@/components/Wordmark';

/**
 * Invite-link landing. Signed out: shows the auth panel (AuthPanel normally
 * redirects a signed-in user to /console, so this page renders its own accept
 * step the moment auth lands instead of mounting AuthPanel while signed in).
 */
export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const token = (params?.token as string) || '';

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [invite, setInvite] = useState<{ valid: boolean; teamName?: string; role?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); }), []);

  useEffect(() => {
    fetch(`/api/developers/team/invites/accept?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then(setInvite)
      .catch(() => setInvite({ valid: false }));
  }, [token]);

  const join = async () => {
    if (!user) return;
    setJoining(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/developers/team/invites/accept', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not join.');
        setJoining(false);
        return;
      }
      router.replace('/console');
    } catch {
      setError('Could not join. Try again.');
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <header className="border-b border-[#2E2C28]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2"><Wordmark /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 pb-24 pt-16">
        {invite === null ? (
          <p className="text-[15px] text-[#918E86]">Checking this invite…</p>
        ) : !invite.valid ? (
          <>
            <h1 className="mb-3 text-[26px] text-[#EFEEEC]">This invite is no longer valid</h1>
            <p className="text-[15px] leading-relaxed text-[#918E86]">
              It may have expired or already been used. Ask your team admin for a
              fresh link.
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-3 text-[26px] leading-tight text-[#EFEEEC]">
              Join {invite.teamName} on Resms
            </h1>
            <p className="mb-6 text-[15px] leading-relaxed text-[#918E86]">
              You are joining as {invite.role === 'admin' ? 'an admin' : 'a member'}.
            </p>

            {!authReady ? (
              <p className="text-[15px] text-[#918E86]">Loading…</p>
            ) : user ? (
              <>
                <p className="mb-4 text-[14px] text-[#C9C6BF]">
                  Signed in as <span className="text-[#EFEEEC]">{user.email}</span>
                </p>
                <button
                  onClick={join}
                  disabled={joining}
                  className="w-full rounded-full bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-8 py-[13px] text-[15px] text-white transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-30"
                >
                  {joining ? 'Joining…' : 'Join team'}
                </button>
                {error && <p className="mt-4 text-[13px] leading-[1.6] text-[#C9C6BF]">{error}</p>}
              </>
            ) : (
              <AuthPanel mode="signup" stayOnPage />
            )}
          </>
        )}
      </main>
    </div>
  );
}
