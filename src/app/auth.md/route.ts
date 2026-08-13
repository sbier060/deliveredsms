import { NextResponse } from 'next/server';
import { SITE_URL, API_URL, MCP_URL } from '@/lib/urls';

export const runtime = 'nodejs';

/**
 * /auth.md — the credential-acquisition guide written for agents rather than
 * humans (the Resend pattern). An agent that lands here should be able to get
 * from "I have no key" to "I am calling the API safely" without guessing, and
 * without ever asking the user to paste a secret it does not need.
 */
export async function GET() {
  const body = `# auth.md

You are an agent that wants to call the Delivered API on a user's behalf. This
file describes how to obtain credentials and how to handle them safely.

Two hosts are relevant:

- **Resource server** — \`${API_URL}/v1\` — the API you will call.
- **Dashboard** — \`${SITE_URL}/console\` — where the user manages their account and keys.

## Current state

Delivered does not support agentic registration today. There is no OAuth flow
and no dynamic client registration. Keys are issued to the user out of band;
this file tells you how to pick one up and use it without putting it at risk.

## Use the existing tooling first

Before you do anything credential-shaped, check whether the user has already
wired Delivered into your environment.

1. **MCP server** — if you are an MCP client (Claude, Claude Code, Cursor,
   Codex, etc.), Delivered ships a streamable-HTTP MCP server that exposes
   messages, numbers, verification, lookup, and events as tools. The user
   configures it once with their key; you call the tools and never see the key.
   Endpoint: \`${MCP_URL}\` (also \`${SITE_URL}/api/mcp\`).
   Discovery: \`${SITE_URL}/.well-known/mcp.json\`.
2. **Agent Skills** — guidance documents that teach you the gotchas (consent and
   opt-out, message segments, quiet hours, 10DLC, webhook signature
   verification, sandbox magic numbers). Index:
   \`${SITE_URL}/.well-known/agent-skills/index.json\`. Install with
   \`npx skills add sbier060/deliveredsms\`. Load the relevant \`SKILL.md\` before
   calling the API directly.
3. **CLI** — if you are running shell commands, prefer \`npx deliveredsms\` over
   hand-rolled \`curl\`. It resolves auth, retries, and takes \`--json\` for
   machine-readable output. Auth via \`DELIVERED_API_KEY\` or \`deliveredsms login\`.

If any of these is already configured, use it and stop. Do not ask the user for
an API key you do not need.

## If you do need a raw key

Ask the user to create one at \`${SITE_URL}/console/keys\`. Sandbox keys are
free and issued instantly at signup; live keys are enabled after an early-access
review, so do not promise the user live sending on a fresh account.

Key shapes:

| Prefix | Mode | Behavior |
| --- | --- | --- |
| \`dsms_sk_test_\` | Sandbox | Instant, free, fully simulated. No real SMS ever leaves the sandbox. |
| \`dsms_sk_live_\` | Live | Real numbers, real delivery, real money. Requires live access. |

\`ghost_sk_test_\` / \`ghost_sk_live_\` are legacy prefixes from the Ghost era and
are still accepted; do not treat them as invalid.

Send the key as a bearer token:

\`\`\`bash
curl ${API_URL}/v1/messages \\
  -H "Authorization: Bearer $DELIVERED_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"+15005550006","from":"<your sandbox number>","body":"hello"}'
\`\`\`

## Handling the key safely

- **Read it from the environment.** \`DELIVERED_API_KEY\` is the expected variable.
  Never inline a key into source, a config file you commit, a test fixture, or a
  shell command that lands in history.
- **Never print it.** Not in logs, not in a summary to the user, not in an error
  message, not in a commit message. If you must refer to a key, use its prefix
  and last four characters.
- **Never send it anywhere but \`api.deliveredsms.com\`.** No third-party service,
  no pastebin, no issue tracker, no other model provider.
- **Prefer a test key.** If the task is "build the integration" rather than "send
  this specific message to this specific person", a \`dsms_sk_test_\` key does
  everything a live key does. Ask for a live key only when real delivery is the
  actual goal, and tell the user that is what you are asking for.
- **Keys cannot be re-displayed.** They are stored hashed (SHA-256). If one is
  lost or exposed, roll it at \`${SITE_URL}/console/keys\` — rolling revokes the
  old key immediately.
- **If you believe a key has leaked, say so and stop.** Tell the user, recommend
  rolling it, and do not keep using it.

## Errors you will actually hit

| Status | Code | What to do |
| --- | --- | --- |
| 401 | \`invalid_api_key\` | Missing, malformed, revoked, or unknown key. Do not retry — ask the user for a valid key. |
| 403 | \`live_access_required\` | A live endpoint was hit with a test key, or live access is not granted yet. Do not retry. |
| 403 | \`tenant_suspended\` | The account is suspended. Stop and tell the user. |
| 429 | \`rate_limited\` | Back off and retry with the \`Retry-After\` header. |

Full error envelope and every code: \`${SITE_URL}/docs/errors.md\`.

## Before you send anything real

A live key sends real messages to real people and costs real money. The
recipient rules are not optional:

- Only message recipients who opted in. You are not the one who obtained
  consent, so confirm with the user that they did.
- Honor STOP / opt-out **in your own application**. Platform-level STOP
  handling is not live yet: the send path checks an opt-out registry, but
  nothing populates it until inbound keyword handling ships. Do not rely on
  Delivered to catch an opt-out for you.
- Do not send at a volume or cadence the user has not asked for. If a task
  implies a bulk send, confirm the recipient count with the user first.

See \`${SITE_URL}/skills/sms-best-practices/SKILL.md\` before your first live send.

## Everything else

- Full site and doc index: \`${SITE_URL}/llms.txt\`
- Complete documentation in one file: \`${SITE_URL}/docs/llms-full.txt\`
- OpenAPI spec: \`${SITE_URL}/openapi.json\` / \`${SITE_URL}/openapi.yaml\`
`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
