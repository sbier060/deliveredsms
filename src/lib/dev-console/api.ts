'use client';

import { auth } from '@/lib/firebase';

export class DevApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Authenticated fetch for /api/developers/* — Firebase ID token as Bearer. */
export async function devFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new DevApiError(401, 'Not signed in');
  const token = await user.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new DevApiError(res.status, (body as { error?: string }).error || `Request failed (${res.status})`);
  }
  return body as T;
}

export interface DevTenant {
  id: string;
  name: string;
  email: string;
  status: 'sandbox' | 'live' | 'suspended';
  quotas: { messagesPerDay: number; numbersMax: number; lookupsPerDay: number };
  liveAccess: 'none' | 'requested' | 'granted';
  firstCallAt: number | null;
  createdAt: number;
  numbers: Array<{ phone_number: string; mode: 'test' | 'live' }>;
}

export interface DevWebhook {
  id: string;
  url: string;
  events: '*' | string[];
  secret: string;
  active: boolean;
  createdAt: number;
  description: string | null;
}

export interface DevKey {
  id: string;
  name: string;
  mode: 'test' | 'live';
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
  status: 'active' | 'revoked';
  key?: string; // present only at mint/roll time
}
