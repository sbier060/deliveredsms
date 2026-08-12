/**
 * Minimal Slack notifier. Delivered posts to its own webhook/channel —
 * deliberately not shared with the consumer product's Slack plumbing.
 * Never throws; ops notifications must not break the request that sent them.
 *
 * Signature matches the consumer lib the platform code was written against:
 * first argument is a Block Kit blocks array (or a plain string).
 */
export async function postSlackMessage(
  blocks: unknown[] | string,
  fallbackText?: string
): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;
  const payload =
    typeof blocks === 'string'
      ? { text: blocks }
      : { text: fallbackText || 'Delivered notification', blocks };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
