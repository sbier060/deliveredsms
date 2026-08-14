import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/console-auth';
import { verifyMfaCode } from '@/lib/api/mfa';

export const runtime = 'nodejs';

/** Check the emailed code; success marks this sign-in as second-factor-verified. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req, { enforceMfa: false });
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let code = '';
  try {
    code = String(((await req.json()) as { code?: string }).code || '');
  } catch {
    // fall through to the format check
  }
  if (!/^\d{6}$/.test(code.trim())) {
    return NextResponse.json({ error: 'invalid_format' }, { status: 400 });
  }

  const result = await verifyMfaCode(user.uid, code);
  if (result === 'verified') return NextResponse.json({ status: 'verified' });
  return NextResponse.json({ error: result }, { status: 400 });
}
