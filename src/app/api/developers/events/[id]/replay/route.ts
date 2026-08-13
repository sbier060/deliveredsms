import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { requireTenantContext } from '@/lib/api/console-auth';
import { toPublicEvent, type StoredEvent } from '@/lib/api/events';
import { deliverEvent } from '@/lib/api/webhooks';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Re-deliver a stored event to the tenant's webhook endpoints. The homepage
 * has advertised "replay any event from the dashboard" since launch; this is
 * the route that makes the claim true.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') {
    return NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });
  }
  if (!/^evt_[0-9A-Za-z]+$/.test(params.id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const keySnap = await db.ref(`apiEvents/${ctx.tenantId}/byId/${params.id}`).get();
  if (!keySnap.exists()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const eventSnap = await db.ref(`apiEvents/${ctx.tenantId}/items/${keySnap.val()}`).get();
  if (!eventSnap.exists()) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await deliverEvent(ctx.tenantId, toPublicEvent(eventSnap.val() as StoredEvent));
  return NextResponse.json({ replayed: true, event_id: params.id });
}
