import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { requireUser } from '@/lib/api/console-auth';
import { getTenantIdByUid, getTenant } from '@/lib/api/tenants';
import { postSlackMessage } from '@/lib/slack';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = await getTenantIdByUid(user.uid);
  const tenant = tenantId ? await getTenant(tenantId) : null;
  if (!tenantId || !tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });
  if (tenant.status === 'live') return NextResponse.json({ ok: true, liveAccess: 'granted' });

  const body = (await req.json().catch(() => ({}))) as { useCase?: string };
  const useCase = typeof body.useCase === 'string' ? body.useCase.slice(0, 1000) : '';
  if (!useCase.trim()) {
    return NextResponse.json({ error: 'Tell us what you are building.' }, { status: 400 });
  }

  await db.ref(`apiTenants/${tenantId}`).update({
    liveAccessRequestedAt: Date.now(),
    liveAccessUseCase: useCase,
  });

  // Best-effort ops ping (goes to the configured Slack channel).
  postSlackMessage(
    [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*OpenSMS — live access request*\n*Tenant:* \`${tenantId}\` (${tenant.email})\n*Use case:* ${useCase}\n\nApprove with:\n\`curl -X POST -H "x-api-secret: $ADMIN_API_SECRET" https://opensms.dev/api/admin/api-tenants/${tenantId}/approve-live\``,
        },
      },
    ],
    `OpenSMS live access request from ${tenant.email}`
  ).catch(() => {});

  return NextResponse.json({ ok: true, liveAccess: 'requested' });
}
