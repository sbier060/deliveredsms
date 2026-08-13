import { db } from '@/lib/firebase-admin';

/**
 * Shared abuse registry check. Delivered and the Ghost consumer product share a
 * Firebase project on purpose: someone banned for abusing one should not get
 * a fresh start on the other. This replaces the consumer repo's 527-line
 * ban-user module with the reads the API path actually needs, keeping the
 * call signature the platform code was written against.
 *
 * Fails OPEN - an RTDB blip must not take the whole API down; the ban check
 * is one layer, not the only one.
 */
export async function checkBanned(
  uid?: string | null,
  email?: string | null,
  ip?: string | null
): Promise<{ banned: boolean; reason?: string }> {
  try {
    if (uid) {
      const snap = await db.ref(`bannedUsers/${uid}`).get();
      if (snap.exists()) return { banned: true, reason: 'account' };
    }
    if (email) {
      const key = email.toLowerCase().replace(/[.#$/\[\]]/g, '_');
      const snap = await db.ref(`bannedEmails/${key}`).get();
      if (snap.exists()) return { banned: true, reason: 'email' };
    }
    if (ip && ip !== 'unknown') {
      const key = ip.replace(/[.:]/g, '_');
      const snap = await db.ref(`bannedIps/${key}`).get();
      if (snap.exists()) return { banned: true, reason: 'ip' };
    }
  } catch {
    // fail open
  }
  return { banned: false };
}
