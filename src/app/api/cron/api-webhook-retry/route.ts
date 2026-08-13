import { NextRequest, NextResponse } from 'next/server';
import { flushWebhookOutbox } from '@/lib/api/webhooks';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Retries failed webhook deliveries from the outbox. Scheduled every 5 minutes. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await flushWebhookOutbox();
  return NextResponse.json({ ok: true, ...result });
}
