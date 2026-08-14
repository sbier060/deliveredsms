import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/console-auth';
import { isMfaVerified, mfaAvailable } from '@/lib/api/mfa';

export const runtime = 'nodejs';

/**
 * Whether the current sign-in still needs the email-OTP step.
 * `enforceMfa: false`: this route is consulted BEFORE the factor is verified.
 */
export async function GET(req: NextRequest) {
  const user = await requireUser(req, { enforceMfa: false });
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const required =
    user.provider === 'password' &&
    mfaAvailable() &&
    !(await isMfaVerified(user.uid, user.authTime));

  return NextResponse.json({ required, email: user.email });
}
