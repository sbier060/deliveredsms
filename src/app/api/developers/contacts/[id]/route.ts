import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { db } from '@/lib/firebase-admin';
import { getContact, deleteContact, sanitizeContactInput } from '@/lib/api/contacts';
import { digits10 } from '@/lib/api/phone';

export const runtime = 'nodejs';
export const maxDuration = 15;

const err = (ctx: string) =>
  NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);
  const contact = await getContact(ctx.tenantId, params.id);
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ contact });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);

  const existing = await getContact(ctx.tenantId, params.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // PATCH takes the same shape as create; missing phone falls back to current.
  const input = sanitizeContactInput({ phone: existing.phone, ...raw });
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const newDigits = digits10(input.phone);
  const updated = {
    ...existing,
    name: 'name' in raw ? input.name : existing.name,
    phone: input.phone,
    digits: newDigits,
    fields: 'fields' in raw ? input.fields : existing.fields,
    tags: 'tags' in raw ? input.tags : existing.tags,
    ...('notes' in raw ? (input.notes ? { notes: input.notes } : {}) : existing.notes ? { notes: existing.notes } : {}),
    updatedAt: Date.now(),
  };

  if (newDigits !== existing.digits) {
    // Phone change: re-point the index, refusing to steal another contact's slot.
    const clash = await db.ref(`apiContacts/${ctx.tenantId}/byDigits/${newDigits}`).get();
    if (clash.exists() && clash.val() !== existing.id) {
      return NextResponse.json({ error: 'Another contact already has that number.' }, { status: 409 });
    }
    await db.ref(`apiContacts/${ctx.tenantId}/byDigits/${existing.digits}`).remove();
    await db.ref(`apiContacts/${ctx.tenantId}/byDigits/${newDigits}`).set(existing.id);
  }

  await db.ref(`apiContacts/${ctx.tenantId}/items/${existing.id}`).set(updated);
  return NextResponse.json({ contact: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);
  const deleted = await deleteContact(ctx.tenantId, params.id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
