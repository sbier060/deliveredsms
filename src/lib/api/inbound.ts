import { storeMessage, convKeyFor } from '@/lib/api/messages';
import { emitEvent } from '@/lib/api/events';
import {
  classify,
  recordOptOut,
  clearOptOut,
  confirmationBody,
  helpBody,
} from '@/lib/api/opt-out';

/**
 * What happens to an inbound message after it is stored.
 *
 * Shared by the sandbox simulator (/v1/test/inbound) and the live carrier
 * ingest (/v1/inbound) so the two cannot diverge — the whole point of the
 * sandbox is that it rehearses the real path, and keyword handling is the part
 * developers most need to rehearse.
 */
export async function processInbound(opts: {
  tenantId: string;
  to: string;
  from: string;
  body: string;
  test: boolean;
  messageId: string;
}): Promise<{ intent: string | null; replyBody: string | null }> {
  const { tenantId, to, from, body, test, messageId } = opts;

  await emitEvent(tenantId, 'message.received', {
    message_id: messageId,
    to,
    from,
    body,
    // Thread key so webhook consumers can group without re-deriving it.
    conversation: convKeyFor({ to, from, direction: 'inbound' }),
  });

  const intent = classify(body);
  let replyBody: string | null = null;

  if (intent === 'opt_out') {
    await recordOptOut(tenantId, from, test ? 'sandbox_keyword' : 'sms_keyword', messageId);
    await emitEvent(tenantId, 'message.opted_out', { phone: from, keyword: body.trim() });
    replyBody = confirmationBody();
  } else if (intent === 'opt_in') {
    await clearOptOut(tenantId, from);
    await emitEvent(tenantId, 'message.opted_in', { phone: from, keyword: body.trim() });
  } else if (intent === 'help') {
    replyBody = helpBody();
  }

  // The confirmation is the one message permitted to a number that just opted
  // out, so it is stored and surfaced like any other outbound rather than sent
  // around the side of the message log.
  if (replyBody) {
    const reply = await storeMessage(tenantId, {
      to: from,
      from: to,
      body: replyBody,
      direction: 'outbound',
      status: 'sent',
      test,
    });
    await emitEvent(tenantId, 'message.sent', {
      message_id: reply.id,
      to: from,
      from: to,
      body: replyBody,
      auto_reply: true,
    });
  }

  return { intent, replyBody };
}
