import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/console-auth';
import { getTenantIdByUid } from '@/lib/api/tenants';
import {
  getEndpoint,
  updateEndpoint,
  deleteEndpoint,
  validateEndpointUrl,
  publicEndpoint,
} from '@/lib/api/webhooks';


export const runtime = 'nodejs';
export const maxDuration = 30;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantIdByUid(user.uid);
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 404 });
  const endpoint = await getEndpoint(tenantId, params.id);
  if (!endpoint) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { active?: boolean; url?: string };
  const patch: { active?: boolean; url?: string } = {};
  if (typeof body.active === 'boolean') patch.active = body.active;
  if (typeof body.url === 'string') {
    const urlError = validateEndpointUrl(body.url.trim());
    if (urlError) return NextResponse.json({ error: urlError }, { status: 400 });
    patch.url = body.url.trim();
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }
  await updateEndpoint(tenantId, params.id, patch);
  const updated = await getEndpoint(tenantId, params.id);
  return NextResponse.json({ webhook: updated ? publicEndpoint(updated) : null });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantIdByUid(user.uid);
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 404 });
  const endpoint = await getEndpoint(tenantId, params.id);
  if (!endpoint) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await deleteEndpoint(tenantId, params.id);
  return NextResponse.json({ deleted: true });
}
