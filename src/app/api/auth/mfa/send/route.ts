import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/console-auth';
import { isMfaVerified, sendMfaCode } from '@/lib/api/mfa';

export const runtime = 'nodejs';

/** Email a 6-digit code to the signed-in user (password sign-ins only). */
export async function POST(req: NextRequest) {
  const user = await requireUser(req, { enforceMfa: false });
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.provider !== 'password' || !user.email) {
    return NextResponse.json({ error: 'not_applicable' }, { status: 400 });
  }
  if (await isMfaVerified(user.uid, user.authTime)) {
    return NextResponse.json({ status: 'already_verified' });
  }
  const status = await sendMfaCode(user.uid, user.email);
  if (status === 'send_failed') {
    return NextResponse.json({ error: 'send_failed' }, { status: 502 });
  }
  return NextResponse.json({ status });
}
