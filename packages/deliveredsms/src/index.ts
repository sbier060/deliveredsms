/**
 * deliveredsms - the official Delivered client.
 *
 * Zero dependencies. Uses the platform `fetch`, so it runs on Node 18+, Bun,
 * Deno, Cloudflare Workers and Vercel Edge without a polyfill.
 */

export const VERSION = '1.0.0';
const DEFAULT_BASE_URL = 'https://api.deliveredsms.com';

// ── errors ──────────────────────────────────────────────────────────────────

export type DeliveredErrorCode =
  | 'invalid_api_key'
  | 'tenant_suspended'
  | 'live_access_required'
  | 'test_mode_only'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'recipient_not_verified'
  | 'verification_blocked'
  | 'verification_not_found'
  | 'idempotency_conflict'
  | 'carrier_error'
  | 'internal_error'
  | 'connection_error';

export class DeliveredError extends Error {
  readonly code: DeliveredErrorCode;
  readonly status: number;
  /** Which request field was wrong, when the API could tell. */
  readonly param?: string;
  /** Seconds to wait, on rate limits. */
  readonly retryAfter?: number;
  /** Why Shield blocked a verification. */
  readonly reason?: string;

  constructor(
    message: string,
    opts: {
      code: DeliveredErrorCode;
      status: number;
      param?: string;
      retryAfter?: number;
      reason?: string;
    }
  ) {
    super(message);
    this.name = 'DeliveredError';
    this.code = opts.code;
    this.status = opts.status;
    this.param = opts.param;
    this.retryAfter = opts.retryAfter;
    this.reason = opts.reason;
  }

  /** True when retrying the same call later could plausibly succeed. */
  get retryable(): boolean {
    return (
      this.status >= 500 ||
      this.code === 'rate_limited' ||
      this.code === 'carrier_error' ||
      this.code === 'connection_error'
    );
  }
}

// ── types ───────────────────────────────────────────────────────────────────

export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'received';

export interface Message {
  id: string;
  object: 'message';
  to: string;
  from: string;
  body: string;
  direction: 'outbound' | 'inbound';
  status: MessageStatus;
  test: boolean;
  created_at: string;
}

export type VerificationStatus =
  | 'pending'
  | 'approved'
  | 'expired'
  | 'max_attempts'
  | 'blocked';

export interface Verification {
  id: string;
  object: 'verification';
  phone: string;
  status: VerificationStatus;
  attempts: number;
  attempts_remaining: number;
  max_attempts: number;
  test: boolean;
  charged: boolean;
  created_at: string;
  expires_at: string;
  expires_in: number;
}

export interface VerificationCheck {
  verified: boolean;
  status: VerificationStatus;
  attempts: number;
  attempts_remaining: number;
  max_attempts: number;
  charged: boolean;
}

export interface PhoneNumber {
  id: string;
  object: 'number';
  phone_number: string;
  status: 'active' | 'released';
  mode: 'test' | 'live';
  created_at: string;
}

export interface AvailableNumber {
  object: 'available_number';
  phone_number: string;
  locality: string;
  region: string;
}

export interface Lookup {
  phone_number: string;
  valid: boolean;
  line_type: string | null;
  carrier: { name: string | null; type: string | null };
  caller_name: string | null;
}

export interface SpamLookup {
  phone_number: string;
  spam_score: number;
  spam_type: string | null;
  severity: string | null;
  last_reported_at: string | null;
  reports: number;
}

export interface SmsEvent {
  id: string;
  object: 'event';
  type: string;
  created_at: string;
  data: Record<string, unknown>;
}

export interface Page<T> {
  data: T[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface DeliveredOptions {
  baseUrl?: string;
  /** Retries for transient failures. Default 2. */
  maxRetries?: number;
  /** Per-request timeout in ms. Default 30_000. */
  timeout?: number;
  fetch?: typeof globalThis.fetch;
}

interface RequestOptions {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  /** Retry this call on transient failure. POSTs need an idempotency key. */
  retryable?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function randomId(): string {
  const bytes = new Uint8Array(16);
  (globalThis.crypto || ({} as Crypto)).getRandomValues?.(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ── client ──────────────────────────────────────────────────────────────────

export class Delivered {
  readonly messages: Messages;
  readonly verify: Verify;
  readonly numbers: Numbers;
  readonly lookup: LookupResource;
  readonly events: Events;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly timeout: number;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(apiKey?: string, options: DeliveredOptions = {}) {
    const env = (globalThis as any).process?.env ?? {};
    const key = apiKey ?? env.DELIVERED_API_KEY ?? env.GHOST_API_KEY;
    if (!apiKey && !env.DELIVERED_API_KEY && env.GHOST_API_KEY) {
      console.error('deliveredsms: GHOST_API_KEY is deprecated; rename it to DELIVERED_API_KEY.');
    }
    if (!key) {
      throw new Error(
        'No Delivered key. Pass one to new Delivered(...) or set DELIVERED_API_KEY. Get one free at https://deliveredsms.com/console'
      );
    }
    this.apiKey = key;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.maxRetries = options.maxRetries ?? 2;
    this.timeout = options.timeout ?? 30_000;
    this.fetchImpl = options.fetch ?? globalThis.fetch;

    this.messages = new Messages(this);
    this.verify = new Verify(this);
    this.numbers = new Numbers(this);
    this.lookup = new LookupResource(this);
    this.events = new Events(this);
  }

  /** True when this client is using a sandbox key. */
  get isTestMode(): boolean {
    return this.apiKey.startsWith('ghost_sk_test_');
  }

  /** @internal */
  async request<T>(opts: RequestOptions): Promise<T> {
    let lastError: DeliveredError | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoff = lastError?.retryAfter
          ? lastError.retryAfter * 1000
          : Math.min(2 ** attempt * 250, 4_000);
        await sleep(backoff);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${this.apiKey}`,
          'User-Agent': `deliveredsms/${VERSION}`,
        };
        if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
        if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

        const res = await this.fetchImpl(`${this.baseUrl}/v1${opts.path}`, {
          method: opts.method,
          headers,
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
          signal: controller.signal,
        });

        const text = await res.text();
        const json = text ? JSON.parse(text) : {};

        if (res.ok) return json as T;

        const err = json?.error ?? {};
        lastError = new DeliveredError(
          err.message || `Request failed with status ${res.status}`,
          {
            code: (err.code as DeliveredErrorCode) || 'internal_error',
            status: res.status,
            param: err.param,
            reason: err.reason,
            retryAfter:
              err.retry_after ??
              (res.headers.get('retry-after')
                ? Number(res.headers.get('retry-after'))
                : undefined),
          }
        );
      } catch (cause) {
        lastError = new DeliveredError(
          cause instanceof Error && cause.name === 'AbortError'
            ? `Request timed out after ${this.timeout}ms`
            : `Could not reach the Delivered API: ${(cause as Error)?.message ?? cause}`,
          { code: 'connection_error', status: 0 }
        );
      } finally {
        clearTimeout(timer);
      }

      // Retry only when the caller marked it safe. A POST without an
      // idempotency key is never retried - resending an SMS because a response
      // was slow is worse than surfacing the error.
      if (!opts.retryable || !lastError.retryable) break;
      // A verify cooldown is a deliberate policy, not a transient failure.
      if (lastError.code === 'rate_limited' && opts.path.startsWith('/verify')) break;
    }

    throw lastError;
  }
}

// ── resources ───────────────────────────────────────────────────────────────

class Messages {
  constructor(private readonly client: Delivered) {}

  /**
   * Send an SMS. Retries are safe: an Idempotency-Key is generated
   * automatically when you don't supply one, so a network blip can never
   * double-send.
   */
  send(
    params: { from: string; to: string; body: string },
    options: { idempotencyKey?: string } = {}
  ): Promise<Message> {
    return this.client.request<Message>({
      method: 'POST',
      path: '/messages',
      body: params,
      idempotencyKey: options.idempotencyKey ?? `sdk_${randomId()}`,
      retryable: true,
    });
  }

  get(id: string): Promise<Message> {
    return this.client.request({ method: 'GET', path: `/messages/${encodeURIComponent(id)}`, retryable: true });
  }

  list(params: { limit?: number; cursor?: string; number?: string } = {}): Promise<Page<Message>> {
    return this.client.request({ method: 'GET', path: `/messages${query(params)}`, retryable: true });
  }
}

class Verify {
  constructor(private readonly client: Delivered) {}

  /**
   * Send a one-time code. You do not need to own a phone number; Delivered sends
   * from its own verification pool.
   */
  send(params: { to: string; appName?: string; from?: string }): Promise<Verification> {
    return this.client.request({
      method: 'POST',
      path: '/verify',
      body: { to: params.to, app_name: params.appName, from: params.from },
    });
  }

  /** Check a code. You are billed only when `verified` is true. */
  check(params: { to: string; code: string }): Promise<VerificationCheck> {
    return this.client.request({ method: 'POST', path: '/verify/check', body: params });
  }

  get(id: string): Promise<Verification> {
    return this.client.request({ method: 'GET', path: `/verify/${encodeURIComponent(id)}`, retryable: true });
  }
}

class Numbers {
  constructor(private readonly client: Delivered) {}

  available(params: { areaCode?: string } = {}): Promise<Page<AvailableNumber>> {
    return this.client.request({
      method: 'GET',
      path: `/numbers/available${query({ area_code: params.areaCode })}`,
      retryable: true,
    });
  }

  buy(phoneNumber: string): Promise<PhoneNumber> {
    return this.client.request({ method: 'POST', path: '/numbers', body: { phone_number: phoneNumber } });
  }

  list(): Promise<Page<PhoneNumber>> {
    return this.client.request({ method: 'GET', path: '/numbers', retryable: true });
  }

  release(phoneNumber: string): Promise<PhoneNumber> {
    return this.client.request({ method: 'DELETE', path: `/numbers/${encodeURIComponent(phoneNumber)}` });
  }
}

class LookupResource {
  constructor(private readonly client: Delivered) {}

  phone(phoneNumber: string): Promise<Lookup> {
    return this.client.request({ method: 'GET', path: `/lookup/${encodeURIComponent(phoneNumber)}`, retryable: true });
  }

  spam(phoneNumber: string): Promise<SpamLookup> {
    return this.client.request({
      method: 'GET',
      path: `/lookup/${encodeURIComponent(phoneNumber)}/spam`,
      retryable: true,
    });
  }
}

class Events {
  constructor(private readonly client: Delivered) {}

  list(params: { limit?: number; cursor?: string; type?: string } = {}): Promise<Page<SmsEvent>> {
    return this.client.request({ method: 'GET', path: `/events${query(params)}`, retryable: true });
  }
}

function query(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return '';
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`;
}

// Back-compat aliases for code written against the ghost-sms package.
export const Ghost = Delivered;
export type Ghost = Delivered;
export const GhostError = DeliveredError;
export type GhostError = DeliveredError;

export default Delivered;
