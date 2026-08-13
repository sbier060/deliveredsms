import { NextRequest, NextResponse } from 'next/server';
import { flushSendQueue } from '@/lib/api/send-queue';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Drains scheduled sends and broadcast fan-out. Same auth as the other crons. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await flushSendQueue();
  if (result.sent || result.failed || result.skipped) {
    console.log('[api-send-flush]', JSON.stringify(result));
  }
  return NextResponse.json(result);
}
