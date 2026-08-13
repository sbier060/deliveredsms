import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import {
  upsertContact,
  sanitizeContactInput,
  listContacts,
  MAX_CONTACTS_PER_TENANT,
} from '@/lib/api/contacts';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH_LIMIT = 200;

/**
 * Import a batch of rows (the client parses the CSV and sends JSON). Upserts
 * by phone number: existing contacts are enriched, never wiped.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') {
    return NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { rows?: unknown };
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: 'rows[] required' }, { status: 400 });
  }
  if (body.rows.length > BATCH_LIMIT) {
    return NextResponse.json({ error: `Max ${BATCH_LIMIT} rows per batch.` }, { status: 400 });
  }

  const existingCount = (await listContacts(ctx.tenantId)).length;
  let created = 0;
  let updated = 0;
  const skipped: Array<{ row: number; reason: string }> = [];

  for (let i = 0; i < body.rows.length; i++) {
    if (existingCount + created >= MAX_CONTACTS_PER_TENANT) {
      skipped.push({ row: i, reason: 'contact limit reached' });
      continue;
    }
    const input = sanitizeContactInput(body.rows[i] as Record<string, unknown>);
    if (!input.ok) {
      skipped.push({ row: i, reason: input.error });
      continue;
    }
    const result = await upsertContact(ctx.tenantId, input);
    if (result.created) created++;
    else updated++;
  }

  return NextResponse.json({ created, updated, skipped });
}
