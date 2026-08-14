import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { db } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Recent verification-exemption log entries: OTP sends that went to opted-out
 * numbers under the transactional exemption. Flattened from
 * apiOptOutOverride/{tenantId}/{digits10}/{push}, newest first.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') {
    return NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });
  }

  const snap = await db.ref(`apiOptOutOverride/${ctx.tenantId}`).get();
  const rows: Array<{ phone: string; at: number; reason: string }> = [];
  if (snap.exists()) {
    snap.forEach((numberNode) => {
      numberNode.forEach((entry) => {
        const v = entry.val() as { at: number; reason: string };
        rows.push({ phone: `+1${numberNode.key}`, at: v.at, reason: v.reason });
      });
    });
  }
  rows.sort((a, b) => b.at - a.at);
  return NextResponse.json({ exemptions: rows.slice(0, 100) });
}
