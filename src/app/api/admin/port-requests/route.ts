import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { isAdminRequest, adminUnauthorized } from '@/lib/admin-auth';
import { advancePortStatus, PORT_STATUSES, type PortRequest, type PortStatus } from '@/lib/api/porting';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Ops queue: every tenant's port requests, newest first. */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return adminUnauthorized();
  const snap = await db.ref('apiPortRequests').get();
  const rows: Array<PortRequest & { tenantId: string }> = [];
  if (snap.exists()) {
    for (const [tenantId, requests] of Object.entries(snap.val() as Record<string, Record<string, PortRequest>>)) {
      for (const request of Object.values(requests)) rows.push({ ...request, tenantId });
    }
  }
  rows.sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ requests: rows });
}

/** Advance a request's status (the human ran the carrier step). */
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return adminUnauthorized();
  const raw = (await req.json().catch(() => ({}))) as {
    tenantId?: string;
    portId?: string;
    status?: string;
    note?: string;
  };
  if (!raw.tenantId || !raw.portId || !PORT_STATUSES.includes(raw.status as PortStatus)) {
    return NextResponse.json({ error: 'tenantId, portId and a valid status required' }, { status: 400 });
  }
  const ok = await advancePortStatus(raw.tenantId, raw.portId, raw.status as PortStatus, raw.note);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ advanced: true });
}
