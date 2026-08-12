import { NextRequest, NextResponse } from 'next/server';
import { requireUser, publicTenant } from '@/lib/api/console-auth';
import { getOrCreateTenant, getTenantIdByUid, getTenant } from '@/lib/api/tenants';
import { checkBanned } from '@/lib/banned';
import { getClientIp } from '@/lib/ip';
import { takeSlot } from '@/lib/api/rate-limit';
import { buildDevWelcomeEmailHtml } from '@/lib/dev-welcome-email-template';
import { sendNoReplyMail } from '@/lib/noreply-email';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Idempotent self-serve provisioning. First call creates the sandbox tenant +
 * first test key (returned ONCE as initialKey); later calls return the tenant.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // The shared abuse registry applies at the front door: someone banned from
  // the consumer product doesn't get a fresh start here with a new Google
  // account on the same identity/IP.
  const ban = await checkBanned(user.uid, user.email, getClientIp(req));
  if (ban.banned) {
    return NextResponse.json(
      { error: 'This account is not permitted to use OpenSMS.' },
      { status: 403 }
    );
  }

  // Sybil brake: tenant creation is cheap for us but not free, and a farm of
  // fresh accounts from one address is never a legitimate signup pattern.
  // Only counts CREATIONS — returning developers hit getOrCreateTenant's
  // existing-tenant path below regardless of this slot.
  const existing = await getTenantIdByUid(user.uid);
  if (!existing) {
    const ipSlot = await takeSlot(`tenant_create_${getClientIp(req).replace(/[.:]/g, '_')}`, 3, 24 * 60 * 60_000);
    if (!ipSlot.allowed) {
      return NextResponse.json(
        { error: 'Too many new accounts from this address today. Contact us if you need more.' },
        { status: 429 }
      );
    }
  }

  const result = await getOrCreateTenant(user.uid, user.email, user.name);

  // Welcome email — HARD-GATED off until the owner approves sending
  // (repo rule: never send email without explicit approval).
  if (result.isNew && process.env.DEV_API_EMAILS_ENABLED === 'true' && user.email) {
    sendNoReplyMail({
      to: user.email,
      subject: 'Your OpenSMS sandbox is live',
      html: buildDevWelcomeEmailHtml({
        name: user.name === 'Developer' ? null : user.name,
        keyLast4: result.initialKey ? result.initialKey.secret.slice(-4) : '????',
        sandboxNumber: result.sandboxNumber || '+1 500-555-XXXX',
        consoleUrl: 'https://opensms.dev/console',
        quickstartUrl: 'https://opensms.dev/docs/quickstart',
      }),
    }).catch(() => {});
  }

  return NextResponse.json({
    tenant: publicTenant(result.tenant),
    isNew: result.isNew,
    ...(result.initialKey
      ? {
          initialKey: {
            id: result.initialKey.keyId,
            key: result.initialKey.secret,
            last4: result.initialKey.secret.slice(-4),
          },
          sandboxNumber: result.sandboxNumber,
        }
      : {}),
  });
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantId = await getTenantIdByUid(user.uid);
  const tenant = tenantId ? await getTenant(tenantId) : null;
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });
  return NextResponse.json({ tenant: publicTenant(tenant) });
}
