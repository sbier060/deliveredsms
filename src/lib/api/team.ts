import { db } from '@/lib/firebase-admin';
import { randomBase62 } from './ids';
import type { ApiTenant } from './types';

/**
 * Multi-user teams.
 *
 * The identity model stays 1 uid : 1 tenant - `apiTenantsByUid/{uid}` remains
 * the single routing index every console route already resolves through, and
 * invite-accept simply writes it. That keeps `getTenantIdByUid` untouched at
 * its eleven call sites; what teams add is a membership record beside it:
 *
 *   apiTenantMembers/{tenantId}/{uid} = { role, email, name, addedAt, addedBy }
 *   apiInvites/{token}               = { tenantId, role, createdBy, createdAt,
 *                                        expiresAt, usedBy?, usedAt? }
 *
 * The tenant owner (tenant.uid) is implicitly admin and has no member record.
 */

export type TeamRole = 'admin' | 'member';

export interface TeamMember {
  role: TeamRole;
  email: string;
  name: string;
  addedAt: number;
  addedBy: string;
  /** Appended to console-composed messages. */
  signature?: string;
}

export interface Invite {
  tenantId: string;
  role: TeamRole;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
  usedBy?: string;
  usedAt?: string;
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_MEMBERS_PER_TENANT = 25;

export async function listMembers(tenantId: string): Promise<Record<string, TeamMember>> {
  const snap = await db.ref(`apiTenantMembers/${tenantId}`).get();
  return snap.exists() ? (snap.val() as Record<string, TeamMember>) : {};
}

export async function getMember(tenantId: string, uid: string): Promise<TeamMember | null> {
  const snap = await db.ref(`apiTenantMembers/${tenantId}/${uid}`).get();
  return snap.exists() ? (snap.val() as TeamMember) : null;
}

/**
 * Role of a uid within a tenant, or null when they have no standing at all.
 * The owner is admin by construction and cannot be demoted or removed.
 */
export async function roleOf(tenant: ApiTenant, uid: string): Promise<TeamRole | null> {
  if (tenant.uid === uid) return 'admin';
  const member = await getMember(tenant.id, uid);
  return member ? member.role : null;
}

export async function createInvite(
  tenantId: string,
  role: TeamRole,
  createdBy: string
): Promise<{ token: string; invite: Invite }> {
  const token = randomBase62(32);
  const invite: Invite = {
    tenantId,
    role,
    createdBy,
    createdAt: Date.now(),
    expiresAt: Date.now() + INVITE_TTL_MS,
  };
  await db.ref(`apiInvites/${token}`).set(invite);
  return { token, invite };
}

export async function getInvite(token: string): Promise<Invite | null> {
  if (!/^[0-9A-Za-z]{32}$/.test(token)) return null;
  const snap = await db.ref(`apiInvites/${token}`).get();
  return snap.exists() ? (snap.val() as Invite) : null;
}

export type AcceptResult =
  | { ok: true; tenantId: string; role: TeamRole }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' | 'already_elsewhere' | 'team_full' };

/**
 * Accept an invite for a signed-in user.
 *
 * Two racing accept calls are settled by claiming `usedBy` with a transaction;
 * the routing index is claimed the same way `getOrCreateTenant` claims it, so
 * a user who already owns or belongs to a different tenant is rejected rather
 * than silently rerouted - leaving a tenant is explicit, never a side effect.
 */
export async function acceptInvite(
  token: string,
  user: { uid: string; email: string; name: string }
): Promise<AcceptResult> {
  const invite = await getInvite(token);
  if (!invite) return { ok: false, reason: 'invalid' };
  if (invite.usedBy) return { ok: false, reason: 'used' };
  if (Date.now() > invite.expiresAt) return { ok: false, reason: 'expired' };

  const existing = await db.ref(`apiTenantsByUid/${user.uid}`).get();
  if (existing.exists() && existing.val() !== invite.tenantId) {
    return { ok: false, reason: 'already_elsewhere' };
  }

  const members = await listMembers(invite.tenantId);
  if (Object.keys(members).length >= MAX_MEMBERS_PER_TENANT) {
    return { ok: false, reason: 'team_full' };
  }

  const claim = await db
    .ref(`apiInvites/${token}/usedBy`)
    .transaction((cur) => (cur === null ? user.uid : undefined));
  if (!claim.committed) return { ok: false, reason: 'used' };

  await db.ref(`apiInvites/${token}/usedAt`).set(new Date().toISOString());
  await db.ref(`apiTenantMembers/${invite.tenantId}/${user.uid}`).set({
    role: invite.role,
    email: user.email,
    name: user.name,
    addedAt: Date.now(),
    addedBy: invite.createdBy,
  } satisfies TeamMember);
  await db.ref(`apiTenantsByUid/${user.uid}`).set(invite.tenantId);

  return { ok: true, tenantId: invite.tenantId, role: invite.role };
}

/** Remove a member: membership record + routing index. Owner is untouchable. */
export async function removeMember(tenant: ApiTenant, uid: string): Promise<boolean> {
  if (uid === tenant.uid) return false;
  const member = await getMember(tenant.id, uid);
  if (!member) return false;
  await db.ref(`apiTenantMembers/${tenant.id}/${uid}`).remove();
  await db.ref(`apiTenantsByUid/${uid}`).remove();
  return true;
}
