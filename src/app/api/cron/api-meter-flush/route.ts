import { NextRequest, NextResponse } from 'next/server';
import { flushMeterOutbox } from '@/lib/api/billing/meter';
import { billingReady } from '@/lib/api/billing/config';
import { postSlackMessage } from '@/lib/slack';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Drains the Stripe meter-event outbox. Scheduled every 5 minutes. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!billingReady()) {
    return NextResponse.json({ ok: true, skipped: 'billing disabled' });
  }

  const result = await flushMeterOutbox();
  if (result.failed > 0 || result.remaining > 500) {
    postSlackMessage(
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Resms meter outbox*\nsent ${result.sent} · failed ${result.failed} · remaining ${result.remaining}`,
          },
        },
      ],
      `Resms meter outbox: ${result.failed} failed, ${result.remaining} remaining`
    ).catch(() => {});
  }
  return NextResponse.json({ ok: true, ...result });
}
