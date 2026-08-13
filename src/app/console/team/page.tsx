'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Copy, Check } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { devFetch } from '@/lib/dev-console/api';
import { Mixpanel } from '@/lib/mixpanel';
import { PageHeading } from '@/components/dev-console/ConsoleTable';

interface TeamRow {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  addedAt?: number;
  isOwner?: boolean;
}

interface TeamResponse {
  owner: TeamRow;
  members: TeamRow[];
  you: { uid: string; role: 'admin' | 'member' };
}

export default function TeamPage() {
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setTeam(await devFetch<TeamResponse>('/api/developers/team'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team');
    }
  }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => { if (u) void load(); }), [load]);

  const invite = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await devFetch<{ url: string }>('/api/developers/team/invites', {
        method: 'POST',
        body: JSON.stringify({ role: inviteRole }),
      });
      setInviteUrl(res.url);
      Mixpanel.track('Team Invite Created', { role: inviteRole, product: 'developer_api' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create invite');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (uid: string) => {
    setBusy(true);
    try {
      await devFetch(`/api/developers/team/${uid}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove member');
    } finally {
      setBusy(false);
    }
  };

  if (error && !team) return <p className="text-[14px] text-[#C9C6BF]">{error}</p>;
  if (!team) return <p className="text-[14px] text-[#918E86]">Loading…</p>;

  const isAdmin = team.you.role === 'admin';
  const rows: TeamRow[] = [{ ...team.owner, isOwner: true }, ...team.members];

  return (
    <div>
      <PageHeading
        title="Team"
        subtitle="Everyone with access to this account. Admins manage keys, billing, numbers, and the team itself."
      />

      <div className="mt-6 overflow-hidden rounded-xl border border-[#2E2C28]">
        <ul className="divide-y divide-[#2E2C28]">
          {rows.map((m) => (
            <li key={m.uid} className="flex items-center justify-between gap-3 bg-[#0F0E0C] px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-[15px] text-[#EFEEEC]">
                  {m.name}
                  {m.uid === team.you.uid && <span className="ml-2 text-[12px] text-[#918E86]">(you)</span>}
                </p>
                <p className="truncate text-[13px] text-[#918E86]">{m.email}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                <span className="rounded-full border border-[#2C2C2E] bg-[#1C1C1E] px-3 py-1 text-[12px] text-[#C9C6BF]">
                  {m.isOwner ? 'owner' : m.role}
                </span>
                {isAdmin && !m.isOwner && m.uid !== team.you.uid && (
                  <button
                    onClick={() => void remove(m.uid)}
                    disabled={busy}
                    className="text-[13px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC] disabled:opacity-30"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {isAdmin && (
        <div className="mt-8">
          <h2 className="text-[16px] text-[#EFEEEC]">Invite someone</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-[#918E86]">
            Generates a single-use link that expires in 7 days. Share it however
            you like — the recipient signs in and lands on this team.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
              className="rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3 py-2 text-[14px] text-[#F2F2F7] outline-none focus:border-[#00D26A]"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={invite}
              disabled={busy}
              className="rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86] disabled:opacity-30"
            >
              Create invite link
            </button>
          </div>

          {inviteUrl && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[#2C2C2E] bg-[#111112] px-3.5 py-2.5">
              <code className="overflow-x-auto whitespace-nowrap text-[13px] text-[#EFEEEC] [font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]">
                {inviteUrl}
              </code>
              <button
                onClick={() => {
                  void copyToClipboard(inviteUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-[#8E8E93] transition-all duration-150 hover:bg-[#2C2C2E] hover:text-[#F2F2F7]"
              >
                {copied ? (
                  <><Check className="h-3 w-3 text-[#00D26A]" /><span className="text-[#00D26A]">Copied</span></>
                ) : (
                  <><Copy className="h-3 w-3" /> Copy</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {error && team && <p className="mt-4 text-[13px] text-[#C9C6BF]">{error}</p>}
    </div>
  );
}
