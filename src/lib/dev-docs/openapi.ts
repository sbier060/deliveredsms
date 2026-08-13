import { SITE_URL, API_URL, MCP_URL } from '@/lib/urls';
/**
 * OpenAPI 3.0 spec for the Delivered — the machine-readable source of truth.
 * Served at /api/v1/openapi.json and /api/v1/openapi.yaml (small local YAML
 * serializer — no yaml dependency in this repo).
 */

const messageSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: 'msg_a1B2c3D4e5F6g7H8' },
    object: { type: 'string', enum: ['message'] },
    to: { type: 'string', example: '+15005550006' },
    from: { type: 'string', example: '+15005550100' },
    body: { type: 'string' },
    direction: { type: 'string', enum: ['outbound', 'inbound'] },
    status: { type: 'string', enum: ['queued', 'sent', 'delivered', 'failed', 'received'] },
    test: { type: 'boolean' },
    created_at: { type: 'string', format: 'date-time' },
  },
};

const errorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          enum: [
            'invalid_api_key', 'tenant_suspended', 'live_access_required',
            'test_mode_only', 'forbidden', 'not_found', 'invalid_request',
            'rate_limited', 'quota_exceeded', 'idempotency_conflict',
            'verification_blocked', 'verification_not_found',
            'carrier_error', 'internal_error',
          ],
        },
        message: { type: 'string' },
      },
    },
  },
};

const listOf = (ref: string) => ({
  type: 'object',
  properties: {
    data: { type: 'array', items: { $ref: ref } },
    has_more: { type: 'boolean' },
    next_cursor: { type: 'string', nullable: true },
  },
});

const errorResponses = {
  '401': { description: 'Missing, malformed, or revoked API key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  '429': { description: 'Rate limit or quota exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Delivered',
    description:
      'Programmable SMS and phone numbers for developers. Send and receive texts, provision numbers, and screen spam with one REST API. Test keys (dsms_sk_test_...) work instantly against the sandbox; live keys are enabled during early access review.',
    version: '1.0.0',
    contact: { url: SITE_URL },
  },
  servers: [{ url: `${API_URL}/v1` }],
  security: [{ apiKey: [] }],
  paths: {
    '/messages': {
      post: {
        operationId: 'sendMessage',
        summary: 'Send an SMS',
        description:
          'Sends an SMS from one of your numbers. In test mode, delivery is simulated (see magic numbers). Supports the Idempotency-Key header.',
        parameters: [
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['to', 'from', 'body'],
                properties: {
                  to: { type: 'string', example: '+15005550006' },
                  from: { type: 'string', example: '+15005550100' },
                  body: { type: 'string', maxLength: 1600 },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Message accepted', content: { 'application/json': { schema: { $ref: '#/components/schemas/Message' } } } },
          '400': { description: 'Invalid request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '409': { description: 'Idempotency conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          ...errorResponses,
        },
      },
      get: {
        operationId: 'listMessages',
        summary: 'List messages',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100, default: 25 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'number', in: 'query', schema: { type: 'string' }, description: 'Filter to messages to/from this number' },
        ],
        responses: {
          '200': { description: 'Messages, newest first', content: { 'application/json': { schema: listOf('#/components/schemas/Message') } } },
          ...errorResponses,
        },
      },
    },
    '/messages/{id}': {
      get: {
        operationId: 'getMessage',
        summary: 'Retrieve a message',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'The message', content: { 'application/json': { schema: { $ref: '#/components/schemas/Message' } } } },
          '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          ...errorResponses,
        },
      },
    },
    '/verify': {
      post: {
        operationId: 'sendVerification',
        summary: 'Send a verification code',
        description:
          'Generates a one-time code, sends it, and enforces expiry, attempt limits and anti-pumping controls. You do NOT need to own a phone number — Delivered sends from its own verification pool. Nothing is billed here; a verification is charged only when the code is checked successfully.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone'],
                properties: {
                  phone: { type: 'string', example: '+14155550132' },
                  app_name: { type: 'string', maxLength: 24, description: "Your product name, shown in the message" },
                  from: { type: 'string', description: 'Optional: send from a number you own instead of the Delivered pool' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Verification created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Verification' } } } },
          '403': { description: 'Blocked by Shield (charged: false)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          ...errorResponses,
        },
      },
    },
    '/verify/check': {
      post: {
        operationId: 'checkVerification',
        summary: 'Check a verification code',
        description: 'The only billable moment in Verify. `charged` tells you whether this call was billed.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone', 'code'],
                properties: { phone: { type: 'string' }, code: { type: 'string', example: '482193' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Check result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    verified: { type: 'boolean' },
                    status: { type: 'string', enum: ['approved', 'pending', 'expired', 'max_attempts'] },
                    attempts: { type: 'integer' },
                    charged: { type: 'boolean' },
                  },
                },
              },
            },
          },
          '404': { description: 'No active verification', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          ...errorResponses,
        },
      },
    },
    '/verify/{id}': {
      get: {
        operationId: 'getVerification',
        summary: 'Retrieve a verification',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'The verification', content: { 'application/json': { schema: { $ref: '#/components/schemas/Verification' } } } },
          '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          ...errorResponses,
        },
      },
    },
    '/numbers/available': {
      get: {
        operationId: 'searchAvailableNumbers',
        summary: 'Search available numbers',
        parameters: [{ name: 'area_code', in: 'query', schema: { type: 'string', example: '415' } }],
        responses: {
          '200': { description: 'Available numbers', content: { 'application/json': { schema: listOf('#/components/schemas/AvailableNumber') } } },
          ...errorResponses,
        },
      },
    },
    '/numbers': {
      get: {
        operationId: 'listNumbers',
        summary: 'List your numbers',
        responses: {
          '200': { description: 'Your active numbers', content: { 'application/json': { schema: listOf('#/components/schemas/Number') } } },
          ...errorResponses,
        },
      },
      post: {
        operationId: 'purchaseNumber',
        summary: 'Purchase a number',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone_number'],
                properties: { phone_number: { type: 'string', example: '+15005550132' } },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Number purchased', content: { 'application/json': { schema: { $ref: '#/components/schemas/Number' } } } },
          ...errorResponses,
        },
      },
    },
    '/numbers/{id}': {
      delete: {
        operationId: 'releaseNumber',
        summary: 'Release a number',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'The E.164 number' }],
        responses: {
          '200': { description: 'Number released', content: { 'application/json': { schema: { $ref: '#/components/schemas/Number' } } } },
          '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          ...errorResponses,
        },
      },
    },
    '/lookup/{phone}': {
      get: {
        operationId: 'lookupPhone',
        summary: 'Look up a phone number',
        description: 'Carrier, line type, and caller name for any US/Canada number.',
        parameters: [{ name: 'phone', in: 'path', required: true, schema: { type: 'string', example: '+14155550132' } }],
        responses: {
          '200': { description: 'Lookup result', content: { 'application/json': { schema: { $ref: '#/components/schemas/Lookup' } } } },
          ...errorResponses,
        },
      },
    },
    '/lookup/{phone}/spam': {
      get: {
        operationId: 'lookupSpam',
        summary: 'Spam signal for a number',
        description: "Aggregate spam score from a 400k-download consumer phone app's real detection graph.",
        parameters: [{ name: 'phone', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Spam aggregate', content: { 'application/json': { schema: { $ref: '#/components/schemas/SpamLookup' } } } },
          ...errorResponses,
        },
      },
    },
    '/events': {
      get: {
        operationId: 'listEvents',
        summary: 'List events',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100, default: 25 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string', example: 'message.delivered' } },
        ],
        responses: {
          '200': { description: 'Events, newest first', content: { 'application/json': { schema: listOf('#/components/schemas/Event') } } },
          ...errorResponses,
        },
      },
    },
    '/test/inbound': {
      post: {
        operationId: 'simulateInbound',
        summary: 'Simulate an inbound SMS (test keys only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['to', 'from', 'body'],
                properties: {
                  to: { type: 'string', description: 'One of your sandbox numbers' },
                  from: { type: 'string' },
                  body: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Simulated inbound message', content: { 'application/json': { schema: { $ref: '#/components/schemas/Message' } } } },
          '403': { description: 'Live keys not allowed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          ...errorResponses,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      apiKey: {
        type: 'http',
        scheme: 'bearer',
        description: 'Your API key, e.g. Authorization: Bearer dsms_sk_test_...',
      },
    },
    schemas: {
      Message: messageSchema,
      Verification: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'ver_a1B2c3D4e5F6g7H8' },
          object: { type: 'string', enum: ['verification'] },
          phone: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'approved', 'expired', 'max_attempts', 'blocked'] },
          attempts: { type: 'integer' },
          test: { type: 'boolean' },
          charged: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
          expires_at: { type: 'string', format: 'date-time' },
        },
      },
      Error: errorSchema,
      Number: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '+15005550132' },
          object: { type: 'string', enum: ['number'] },
          phone_number: { type: 'string' },
          status: { type: 'string', enum: ['active', 'released'] },
          mode: { type: 'string', enum: ['test', 'live'] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      AvailableNumber: {
        type: 'object',
        properties: {
          object: { type: 'string', enum: ['available_number'] },
          phone_number: { type: 'string' },
          locality: { type: 'string' },
          region: { type: 'string' },
        },
      },
      Lookup: {
        type: 'object',
        properties: {
          phone_number: { type: 'string' },
          valid: { type: 'boolean' },
          line_type: { type: 'string', nullable: true, example: 'mobile' },
          carrier: {
            type: 'object',
            properties: {
              name: { type: 'string', nullable: true },
              type: { type: 'string', nullable: true },
            },
          },
          caller_name: { type: 'string', nullable: true },
        },
      },
      SpamLookup: {
        type: 'object',
        properties: {
          phone_number: { type: 'string' },
          spam_score: { type: 'integer', minimum: 0, maximum: 100 },
          spam_type: { type: 'string', nullable: true, example: 'robocall' },
          severity: { type: 'string', nullable: true },
          last_reported_at: { type: 'string', format: 'date-time', nullable: true },
          reports: { type: 'integer' },
        },
      },
      Event: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'evt_a1B2c3D4e5F6g7H8' },
          object: { type: 'string', enum: ['event'] },
          type: {
            type: 'string',
            enum: ['message.sent', 'message.delivered', 'message.failed', 'message.received', 'message.opted_out', 'message.opted_in', 'number.purchased', 'number.released', 'verification.sent', 'verification.approved', 'verification.failed', 'verification.blocked'],
          },
          created_at: { type: 'string', format: 'date-time' },
          data: { type: 'object' },
        },
      },
    },
  },
} as const;

/** Minimal YAML serializer sufficient for the spec above (no external dep). */
export function toYaml(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') {
    if (/^[A-Za-z0-9_\-./+#{}$]+$/.test(value) && value !== 'null') return value;
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((item) => {
        const rendered = toYaml(item, indent + 1);
        if (typeof item === 'object' && item !== null) {
          return `${pad}- ${rendered.trimStart().replace(/\n/g, `\n`)}`.replace(
            `${pad}- ${'  '.repeat(indent + 1)}`,
            `${pad}- `
          );
        }
        return `${pad}- ${rendered}`;
      })
      .join('\n');
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '{}';
  return entries
    .map(([k, v]) => {
      const key = /^[A-Za-z0-9_\-$]+$/.test(k) ? k : JSON.stringify(k);
      if (v !== null && typeof v === 'object') {
        const rendered = toYaml(v, indent + 1);
        if (rendered === '[]' || rendered === '{}') return `${pad}${key}: ${rendered}`;
        return `${pad}${key}:\n${rendered}`;
      }
      return `${pad}${key}: ${toYaml(v)}`;
    })
    .join('\n');
}
