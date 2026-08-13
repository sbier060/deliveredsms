import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { listContacts } from '@/lib/api/contacts';
import { toCsv } from '@/lib/csv';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Whole address book as CSV. Custom fields become columns. */
export async function GET(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') {
    return NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });
  }

  const contacts = await listContacts(ctx.tenantId);
  const fieldNames = [...new Set(contacts.flatMap((c) => Object.keys(c.fields)))].sort();

  const rows: string[][] = [
    ['name', 'phone', 'tags', 'notes', ...fieldNames],
    ...contacts.map((c) => [
      c.name,
      c.phone,
      c.tags.join(';'),
      c.notes || '',
      ...fieldNames.map((f) => c.fields[f] || ''),
    ]),
  ];

  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="delivered-contacts.csv"',
    },
  });
}
