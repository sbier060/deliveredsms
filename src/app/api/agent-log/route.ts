import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * Agent-traffic counter. "Check your server logs, not your analytics" -
 * agents don't run JS, so Mixpanel never sees them. The middleware fires
 * a beacon here for known AI crawler/agent user-agents; this rolls daily
 * counts per bot and per path into RTDB where the admin surface (and a
 * future digest) can read them.
 */
export async function POST(req: NextRequest) {
  try {
    const { bot, path } = (await req.json()) as { bot?: string; path?: string };
    if (!bot || typeof bot !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const day = new Date().toISOString().slice(0, 10);
    const safeBot = bot.replace(/[.#$/\[\]]/g, '_').slice(0, 40);
    const safePath = (path || '/').replace(/[.#$\[\]]/g, '_').slice(0, 80).replace(/\//g, '|');
    await db.ref(`apiAgentTraffic/${day}/${safeBot}/total`).transaction((n) => (n || 0) + 1);
    await db.ref(`apiAgentTraffic/${day}/${safeBot}/paths/${safePath}`).transaction((n) => (n || 0) + 1);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
