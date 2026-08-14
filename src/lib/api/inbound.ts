import { storeMessage, convKeyFor } from '@/lib/api/messages';
import { emitEvent } from '@/lib/api/events';
import {
  classify,
  classifyRevocationPhrase,
  recordOptOut,
  recordOptIn,
  confirmationBody,
  helpBody,
  hasOptedOut,
} from '@/lib/api/opt-out';
import { aiRevocationCheck } from '@/lib/api/revocation-ai';
import {
  getAutoReply,
  shouldFire,
  claimCooldown,
  looksLikeVerificationCode,
  AUTO_REPLY_MAX_LENGTH,
} from '@/lib/api/auto-reply';

/**
 * What happens to an inbound message after it is stored.
 *
 * Shared by the sandbox simulator (/v1/test/inbound) and the live carrier
 * ingest (/v1/inbound) so the two cannot diverge - the whole point of the
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

  let intent = classify(body);
  let replyBody: string | null = null;
  let autoReply = false;
  // Which revocation tier fired: exact keyword, plain-English phrase, or the
  // LLM. Keywords always win; the later tiers only run when earlier ones miss.
  let method: 'keyword' | 'phrase' | 'ai' = 'keyword';
  let detected = body.trim();
  let confidence: number | undefined;

  if (intent === null) {
    const phrase = classifyRevocationPhrase(body);
    if (phrase.hit) {
      intent = 'opt_out';
      method = 'phrase';
      detected = phrase.phrase ?? detected;
    } else if (
      body.trim().length <= 300 &&
      !looksLikeVerificationCode(body) &&
      // Cheap prefilter so ordinary chatter never reaches the model; anything
      // revocation-shaped contains at least one of these.
      /\b(stop|quit|unsubscribe|remove|text|txt|message|msg|contact|sms|off|enough|spam|not?|never)\b/i.test(body) &&
      // Sandbox inbounds are simulator traffic; keep them deterministic and
      // free unless explicitly enabled for QA.
      (!test || process.env.CONSENT_AI_IN_SANDBOX === '1')
    ) {
      // Tier 3: awaited inline with a hard 2.5s cap (fail-silent without a
      // key), because serverless gives fire-and-forget no time to land.
      const verdict = await aiRevocationCheck(body);
      if (verdict?.revocation && verdict.confidence >= 0.8) {
        intent = 'opt_out';
        method = 'ai';
        confidence = verdict.confidence;
      }
    }
  }

  if (intent === 'opt_out') {
    const viaPrefix = test ? 'sandbox' : 'sms';
    const via =
      method === 'keyword' ? `${viaPrefix}_keyword` : method === 'phrase' ? `${viaPrefix}_phrase` : 'ai_detected';
    await recordOptOut(tenantId, from, via, messageId, {
      method,
      keyword: detected,
      ...(confidence !== undefined ? { confidence } : {}),
    });
    await emitEvent(tenantId, 'message.opted_out', {
      phone: from,
      keyword: detected,
      method,
      message_id: messageId,
      ...(confidence !== undefined ? { confidence } : {}),
    });
    replyBody = confirmationBody();
  } else if (intent === 'opt_in') {
    await recordOptIn(tenantId, from, test ? 'sandbox_keyword' : 'sms_keyword', {
      method: 'keyword',
      keyword: detected,
    });
    await emitEvent(tenantId, 'message.opted_in', {
      phone: from,
      keyword: detected,
      method: 'keyword',
      message_id: messageId,
    });
  } else if (intent === 'help') {
    replyBody = helpBody();
  } else {
    // Ordinary message: the tenant's auto-reply, guarded in the order the
    // consumer pipeline proved out - keywords always win (handled above),
    // never answer an OTP, never text an opted-out counterparty, and claim
    // the 4h per-conversation cooldown BEFORE sending so concurrent inbound
    // cannot double-send.
    const config = await getAutoReply(tenantId, to);
    if (
      config &&
      shouldFire(config) &&
      !looksLikeVerificationCode(body) &&
      !(await hasOptedOut(tenantId, from))
    ) {
      const convKey = convKeyFor({ to, from, direction: 'inbound' });
      if (await claimCooldown(tenantId, convKey)) {
        replyBody = config.message.slice(0, AUTO_REPLY_MAX_LENGTH);
        autoReply = true;
      }
    }
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
      ...(autoReply ? { kind: 'auto_reply' } : { kind: 'keyword_reply' }),
    });
  }

  return { intent, replyBody };
}
