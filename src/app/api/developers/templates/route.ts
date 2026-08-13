import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api/console-auth';
import { listTemplates, createTemplate, deleteTemplate, MAX_TEMPLATES } from '@/lib/api/merge';

export const runtime = 'nodejs';
export const maxDuration = 15;

const err = (ctx: string) =>
  NextResponse.json({ error: ctx }, { status: ctx === 'unauthorized' ? 401 : ctx === 'forbidden' ? 403 : 404 });

export async function GET(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);
  return NextResponse.json({ templates: await listTemplates(ctx.tenantId) });
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);

  const raw = (await req.json().catch(() => ({}))) as { name?: unknown; body?: unknown };
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 60) : '';
  const body = typeof raw.body === 'string' ? raw.body.slice(0, 1600) : '';
  if (!name || !body) return NextResponse.json({ error: 'name and body required' }, { status: 400 });

  if ((await listTemplates(ctx.tenantId)).length >= MAX_TEMPLATES) {
    return NextResponse.json({ error: 'Template limit reached.' }, { status: 400 });
  }
  return NextResponse.json({ template: await createTemplate(ctx.tenantId, name, body) }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireTenantContext(req);
  if (typeof ctx === 'string') return err(ctx);
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!/^tpl_[0-9A-Za-z]+$/.test(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  await deleteTemplate(ctx.tenantId, id);
  return NextResponse.json({ deleted: true });
}
