import { NextRequest, NextResponse } from 'next/server';
import { MCP_URL } from '@/lib/urls';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Delivered MCP server - Streamable HTTP transport in stateless JSON mode
 * (every POST gets a single application/json response; no SSE, no sessions).
 * Hand-rolled JSON-RPC 2.0 - deliberately no SDK dependency.
 *
 * A protocol adapter over the public REST API: every tool call self-fetches
 * /api/v1/* with the caller's Authorization header passed through, so auth,
 * rate limits, quotas, and validation are enforced by exactly one code path.
 * Connect with: Authorization: Bearer dsms_sk_test_... (same keys as the API).
 */

const PROTOCOL_VERSION = '2025-03-26';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

const TOOLS = [
  {
    name: 'send_message',
    description:
      'Send an SMS from one of your Delivered numbers. In sandbox (test keys), delivery is simulated: +15005550006 delivers, +15005550002 fails.',
    inputSchema: {
      type: 'object',
      required: ['from', 'to', 'body'],
      properties: {
        from: { type: 'string', description: 'A number you own, E.164 (see list_numbers)' },
        to: { type: 'string', description: 'Destination number, E.164 US/Canada' },
        body: { type: 'string', description: 'Message text (max 1600 chars)' },
      },
    },
    request: (a: Record<string, unknown>) => ({
      method: 'POST',
      path: '/api/v1/messages',
      body: a,
    }),
  },
  {
    name: 'get_message',
    description: 'Retrieve a message by its msg_... id.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
    request: (a: Record<string, unknown>) => ({
      method: 'GET',
      path: `/api/v1/messages/${encodeURIComponent(String(a.id))}`,
    }),
  },
  {
    name: 'list_messages',
    description: 'List your messages, newest first.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 25, max 100)' },
        number: { type: 'string', description: 'Filter to messages to/from this number' },
      },
    },
    request: (a: Record<string, unknown>) => ({
      method: 'GET',
      path: `/api/v1/messages?limit=${Number(a.limit) || 25}${
        a.number ? `&number=${encodeURIComponent(String(a.number))}` : ''
      }`,
    }),
  },
  {
    name: 'send_verification',
    description:
      'Send a one-time verification code (OTP) to a phone number. Delivered generates the code, handles expiry (10 min) and attempt limits (5), and blocks SMS-pumping fraud. Prefer this over building OTP on send_message.',
    inputSchema: {
      type: 'object',
      required: ['phone'],
      properties: {
        phone: { type: 'string', description: 'Destination number, E.164 US/Canada' },
        app_name: { type: 'string', description: "Your product name, shown in the message (max 24 chars)" },
      },
    },
    request: (a: Record<string, unknown>) => ({
      method: 'POST',
      path: '/api/v1/verify',
      body: a,
    }),
  },
  {
    name: 'check_verification',
    description:
      'Check a verification code submitted by a user. Returns {verified, status, charged}. You are only billed when verified is true. NEVER log the code.',
    inputSchema: {
      type: 'object',
      required: ['phone', 'code'],
      properties: {
        phone: { type: 'string' },
        code: { type: 'string', description: 'The code the user entered' },
      },
    },
    request: (a: Record<string, unknown>) => ({
      method: 'POST',
      path: '/api/v1/verify/check',
      body: a,
    }),
  },
  {
    name: 'list_numbers',
    description: 'List the phone numbers on your account.',
    inputSchema: { type: 'object', properties: {} },
    request: () => ({ method: 'GET', path: '/api/v1/numbers' }),
  },
  {
    name: 'search_available_numbers',
    description: 'Search purchasable numbers by area code.',
    inputSchema: {
      type: 'object',
      properties: { area_code: { type: 'string', description: '3-digit area code, e.g. 415' } },
    },
    request: (a: Record<string, unknown>) => ({
      method: 'GET',
      path: `/api/v1/numbers/available?area_code=${encodeURIComponent(String(a.area_code || '415'))}`,
    }),
  },
  {
    name: 'purchase_number',
    description: 'Purchase a phone number for your account (sandbox numbers with test keys).',
    inputSchema: {
      type: 'object',
      required: ['phone_number'],
      properties: { phone_number: { type: 'string', description: 'E.164 number from search_available_numbers' } },
    },
    request: (a: Record<string, unknown>) => ({
      method: 'POST',
      path: '/api/v1/numbers',
      body: a,
    }),
  },
  {
    name: 'release_number',
    description: 'Release a number you own.',
    inputSchema: {
      type: 'object',
      required: ['phone_number'],
      properties: { phone_number: { type: 'string' } },
    },
    request: (a: Record<string, unknown>) => ({
      method: 'DELETE',
      path: `/api/v1/numbers/${encodeURIComponent(String(a.phone_number))}`,
    }),
  },
  {
    name: 'lookup_phone',
    description: 'Look up carrier, line type, and caller name for any US/Canada number.',
    inputSchema: {
      type: 'object',
      required: ['phone'],
      properties: { phone: { type: 'string' } },
    },
    request: (a: Record<string, unknown>) => ({
      method: 'GET',
      path: `/api/v1/lookup/${encodeURIComponent(String(a.phone))}`,
    }),
  },
  {
    name: 'lookup_spam',
    description: "Get the aggregate spam signal for a number from Delivered's detection graph.",
    inputSchema: {
      type: 'object',
      required: ['phone'],
      properties: { phone: { type: 'string' } },
    },
    request: (a: Record<string, unknown>) => ({
      method: 'GET',
      path: `/api/v1/lookup/${encodeURIComponent(String(a.phone))}/spam`,
    }),
  },
  {
    name: 'simulate_inbound',
    description: 'Sandbox only: simulate an inbound SMS to one of your test numbers (emits a message.received event).',
    inputSchema: {
      type: 'object',
      required: ['to', 'from', 'body'],
      properties: {
        to: { type: 'string', description: 'One of your sandbox numbers' },
        from: { type: 'string' },
        body: { type: 'string' },
      },
    },
    request: (a: Record<string, unknown>) => ({
      method: 'POST',
      path: '/api/v1/test/inbound',
      body: a,
    }),
  },
  {
    name: 'list_events',
    description: 'List recent events (message.sent/delivered/failed/received, number.purchased/released), newest first.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        type: { type: 'string', description: 'Filter by event type' },
      },
    },
    request: (a: Record<string, unknown>) => ({
      method: 'GET',
      path: `/api/v1/events?limit=${Number(a.limit) || 25}${
        a.type ? `&type=${encodeURIComponent(String(a.type))}` : ''
      }`,
    }),
  },
];

function rpcResult(id: number | string | null | undefined, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, result });
}

function rpcError(
  id: number | string | null | undefined,
  code: number,
  message: string,
  status = 200
) {
  return NextResponse.json(
    { jsonrpc: '2.0', id: id ?? null, error: { code, message } },
    { status }
  );
}

export async function POST(req: NextRequest) {
  let rpc: JsonRpcRequest;
  try {
    rpc = (await req.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, 'Parse error', 400);
  }
  if (!rpc || rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
    return rpcError(rpc?.id, -32600, 'Invalid request', 400);
  }

  switch (rpc.method) {
    case 'initialize':
      return rpcResult(rpc.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'delivered', version: '1.0.0' },
        instructions:
          'Delivered MCP server: programmable SMS, phone numbers, and spam lookup. ' +
          'Authenticate with your API key (Authorization: Bearer dsms_sk_...). ' +
          'Free sandbox keys: https://deliveredsms.com/console. ' +
          'Docs: https://deliveredsms.com/docs/quickstart',
      });

    case 'notifications/initialized':
    case 'notifications/cancelled':
      return new NextResponse(null, { status: 202 });

    case 'ping':
      return rpcResult(rpc.id, {});

    case 'tools/list':
      return rpcResult(rpc.id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      });

    case 'tools/call': {
      const authz = req.headers.get('authorization');
      if (!authz) {
        return rpcError(
          rpc.id,
          -32001,
          'Authentication required: pass your API key as Authorization: Bearer dsms_sk_...'
        );
      }
      const name = String(rpc.params?.name || '');
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return rpcError(rpc.id, -32602, `Unknown tool: ${name}`);
      const args = (rpc.params?.arguments || {}) as Record<string, unknown>;
      const call = tool.request(args);

      const res = await fetch(`${req.nextUrl.origin}${call.path}`, {
        method: call.method,
        headers: {
          Authorization: authz,
          ...('body' in call && call.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...('body' in call && call.body ? { body: JSON.stringify(call.body) } : {}),
      });
      const text = await res.text();
      return rpcResult(rpc.id, {
        content: [{ type: 'text', text }],
        isError: !res.ok,
      });
    }

    default:
      return rpcError(rpc.id, -32601, `Method not found: ${rpc.method}`);
  }
}

/** Stateless server: no SSE stream to offer. */
export async function GET() {
  return NextResponse.json(
    {
      name: 'delivered',
      transport: 'streamable-http',
      mode: 'stateless',
      endpoint: MCP_URL,
      hint: 'POST JSON-RPC 2.0 (initialize, tools/list, tools/call) with Authorization: Bearer dsms_sk_...',
    },
    { status: 405 }
  );
}
