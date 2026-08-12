import type { Metadata } from 'next';
import { generateMetadata as buildMetadata } from '@/lib/metadata';
import DocsMarkdown from '@/components/dev-docs/DocsMarkdown';
import CodeTabs from '@/components/dev-docs/CodeTabs';
import { buildSendSnippets } from '@/lib/dev-docs/snippets';

export const metadata: Metadata = buildMetadata({
  title: 'Quickstart | Delivered Docs',
  description: 'Send your first SMS with the Delivered in under five minutes.',
  path: '/docs/quickstart',
});

const INTRO = `# Quickstart

Send your first SMS in under five minutes. No card, no sales call — a test key
works instantly against the sandbox.

## 1. Get a key

Create a free account at [the console](/console). A sandbox tenant
is provisioned automatically with a test key (\`ghost_sk_test_...\`) and a
sandbox number. The key is shown once — copy it. If you just signed up in this
browser, your key is already filled into the snippets below.

## 2. Send a message
`;

const REST = `## 3. Read the response

\`\`\`json
{
  "id": "msg_a1B2c3D4e5F6g7H8",
  "object": "message",
  "to": "+15005550006",
  "from": "+15005550100",
  "body": "Hello from Delivered",
  "direction": "outbound",
  "status": "sent",
  "test": true,
  "created_at": "2026-08-06T16:20:00.000Z"
}
\`\`\`

Fetch it back anytime with \`GET /v1/messages/{id}\`, and watch the delivery
lifecycle in \`GET /v1/events\` — a \`message.delivered\` event follows ~2s later.

## 4. Simulate a reply

\`\`\`bash
curl -X POST https://api.deliveredsms.com/v1/test/inbound \\
  -H "Authorization: Bearer dsms_sk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+15005550100",
    "from": "+14155550132",
    "body": "Hey, got your message!"
  }'
\`\`\`

The inbound message lands in \`GET /v1/messages\` and emits a
\`message.received\` event — exactly what a real inbound SMS will do in live
mode.

## 5. Go live

When you're ready to send real SMS from real numbers, request live access from
the [console](/console) — one sentence about what you're building,
and we usually flip the switch same day. Live access is free during early
access.
`;

export default function QuickstartPage() {
  return (
    <article>
      <DocsMarkdown markdown={INTRO} />
      <div className="mt-4">
        <CodeTabs snippets={buildSendSnippets()} keyAware />
      </div>
      <DocsMarkdown markdown={REST} />
    </article>
  );
}
