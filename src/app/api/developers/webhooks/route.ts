import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/console-auth';
import { getTenantIdByUid } from '@/lib/api/tenants';
import {
  listEndpoints,
  createEndpoint,
  validateEndpointUrl,
  publicEndpoint,
  MAX_ENDPOINTS_PER_TENANT,
} from '@/lib/api/webhooks';
import type { ApiEventType } from '@/lib/api/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

const VALID_EVENTS: ApiEventType[] = [
  'message.sent',
  'message.delivered',
  'message.failed',
  'message.received',
  'message.opted_out',
  'message.opted_in',
  'number.purchased',
  'number.released',
  'verification.sent',
  'verification.approved',
  'verification.failed',
  'verification.blocked',
];

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantIdByUid(user.uid);
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 404 });
  // Admin surface: members must not reach keys/billing/webhooks. The role
  // check rides on the same resolution the route already does.
  {
    const { roleOf } = await import('@/lib/api/team');
    const { getTenant: _gt } = await import('@/lib/api/tenants');
    const _t = await _gt(tenantId);
    if (!_t || (await roleOf(_t, user.uid)) !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
  }
  const endpoints = await listEndpoints(tenantId);
  return NextResponse.json({ webhooks: endpoints.map(publicEndpoint) });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantIdByUid(user.uid);
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 404 });
  // Admin surface: members must not reach keys/billing/webhooks. The role
  // check rides on the same resolution the route already does.
  {
    const { roleOf } = await import('@/lib/api/team');
    const { getTenant: _gt } = await import('@/lib/api/tenants');
    const _t = await _gt(tenantId);
    if (!_t || (await roleOf(_t, user.uid)) !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
  }

  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    events?: string[];
    description?: string;
  };
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  const urlError = validateEndpointUrl(url);
  if (urlError) return NextResponse.json({ error: urlError }, { status: 400 });

  let events: '*' | ApiEventType[] = '*';
  if (Array.isArray(body.events) && body.events.length > 0) {
    const filtered = body.events.filter((e): e is ApiEventType =>
      VALID_EVENTS.includes(e as ApiEventType)
    );
    if (filtered.length === 0) {
      return NextResponse.json({ error: 'No valid event types given.' }, { status: 400 });
    }
    events = filtered;
  }

  const existing = await listEndpoints(tenantId);
  if (existing.length >= MAX_ENDPOINTS_PER_TENANT) {
    return NextResponse.json(
      { error: `Limit of ${MAX_ENDPOINTS_PER_TENANT} webhook endpoints reached.` },
      { status: 400 }
    );
  }

  const endpoint = await createEndpoint(
    tenantId,
    url,
    events,
    typeof body.description === 'string' ? body.description.slice(0, 120) : undefined
  );
  return NextResponse.json({ webhook: publicEndpoint(endpoint) }, { status: 201 });
}
