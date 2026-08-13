import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { db } from '@/lib/firebase-admin';
import { getMember } from '@/lib/api/team';

export const runtime = 'nodejs';
export const maxDuration = 15;

const err = (ctx: string) =>
  NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });

/** Your own member profile — today that means the compose signature. */
export async function GET(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);
  const member = await getMember(ctx.tenantId, ctx.user.uid);
  return NextResponse.json({ signature: member?.signature || '', role: ctx.role });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);

  const raw = (await req.json().catch(() => ({}))) as { signature?: unknown };
  const signature = typeof raw.signature === 'string' ? raw.signature.slice(0, 160) : '';

  // The owner has no member record; give them one lazily so the signature has
  // somewhere to live without changing the tenant shape.
  const existing = await getMember(ctx.tenantId, ctx.user.uid);
  if (existing) {
    await db.ref(`apiTenantMembers/${ctx.tenantId}/${ctx.user.uid}/signature`).set(signature);
  } else {
    await db.ref(`apiTenantMembers/${ctx.tenantId}/${ctx.user.uid}`).set({
      role: 'admin',
      email: ctx.user.email,
      name: ctx.user.name,
      addedAt: Date.now(),
      addedBy: ctx.user.uid,
      signature,
    });
  }
  return NextResponse.json({ signature });
}
