import { db } from '@/lib/firebase-admin';
import { randomBase62 } from './ids';
import { normalizeE164, digits10 } from './phone';

/**
 * Contacts - the address book behind the inbox and broadcasts.
 *
 *   apiContacts/{tenantId}/items/{contactId} = Contact
 *   apiContacts/{tenantId}/byDigits/{digits10} = contactId
 *
 * byDigits is the dedupe key and how inbound messages resolve to a name.
 * One contact per phone number per tenant; import upserts through it.
 */

export interface Contact {
  id: string;
  name: string;
  phone: string; // E.164
  digits: string; // 10-digit index key
  fields: Record<string, string>;
  tags: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export const newContactId = () => `ct_${randomBase62(12)}`;
export const MAX_CONTACTS_PER_TENANT = 50_000;
const MAX_TAGS = 20;
const MAX_FIELDS = 20;

const base = (tenantId: string) => `apiContacts/${tenantId}`;

export function sanitizeContactInput(raw: {
  name?: unknown;
  phone?: unknown;
  fields?: unknown;
  tags?: unknown;
  notes?: unknown;
}): { ok: true; name: string; phone: string; fields: Record<string, string>; tags: string[]; notes?: string } | { ok: false; error: string } {
  const phone = normalizeE164(raw.phone);
  if (!phone) return { ok: false, error: '`phone` must be a valid US/Canada number in E.164 format.' };
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 120) : '';

  const fields: Record<string, string> = {};
  if (raw.fields && typeof raw.fields === 'object') {
    for (const [k, v] of Object.entries(raw.fields as Record<string, unknown>).slice(0, MAX_FIELDS)) {
      const key = k.trim().slice(0, 40).replace(/[.#$/[\]]/g, '_');
      if (key && typeof v === 'string') fields[key] = v.slice(0, 500);
    }
  }
  const tags = Array.isArray(raw.tags)
    ? [...new Set(raw.tags.filter((t): t is string => typeof t === 'string').map((t) => t.trim().slice(0, 40)).filter(Boolean))].slice(0, MAX_TAGS)
    : [];
  const notes = typeof raw.notes === 'string' ? raw.notes.slice(0, 2000) : undefined;

  return { ok: true, name, phone, fields, tags, ...(notes ? { notes } : {}) };
}

/** RTDB drops empty arrays/objects on write; restore them on read. */
function hydrate(raw: Contact): Contact {
  return { ...raw, tags: raw.tags || [], fields: raw.fields || {} };
}

export async function getContact(tenantId: string, contactId: string): Promise<Contact | null> {
  const snap = await db.ref(`${base(tenantId)}/items/${contactId}`).get();
  return snap.exists() ? hydrate(snap.val() as Contact) : null;
}

export async function getContactByPhone(tenantId: string, phone: string): Promise<Contact | null> {
  const idSnap = await db.ref(`${base(tenantId)}/byDigits/${digits10(phone)}`).get();
  if (!idSnap.exists()) return null;
  return getContact(tenantId, idSnap.val() as string);
}

export async function listContacts(tenantId: string): Promise<Contact[]> {
  // Whole-node read + in-memory sort: the shared RTDB instance takes no
  // .indexOn additions, and the node is bounded per tenant.
  const snap = await db.ref(`${base(tenantId)}/items`).get();
  if (!snap.exists()) return [];
  return (Object.values(snap.val()) as Contact[]).map(hydrate).sort((a, b) =>
    (a.name || a.phone).localeCompare(b.name || b.phone)
  );
}

/**
 * Create-or-update keyed on the phone number. Existing contacts keep values
 * the incoming row leaves blank - an import with only name+phone must not
 * wipe tags somebody curated by hand.
 */
export async function upsertContact(
  tenantId: string,
  input: { name: string; phone: string; fields: Record<string, string>; tags: string[]; notes?: string }
): Promise<{ contact: Contact; created: boolean }> {
  const digits = digits10(input.phone);
  const existing = await getContactByPhone(tenantId, input.phone);

  if (existing) {
    const notes = input.notes ?? existing.notes;
    const updated: Contact = {
      ...existing,
      name: input.name || existing.name,
      fields: { ...existing.fields, ...input.fields },
      tags: [...new Set([...(existing.tags || []), ...input.tags])],
      // RTDB rejects undefined values outright - omit the key entirely.
      ...(notes !== undefined ? { notes } : {}),
      updatedAt: Date.now(),
    };
    if (notes === undefined) delete (updated as Partial<Contact>).notes;
    await db.ref(`${base(tenantId)}/items/${existing.id}`).set(updated);
    return { contact: updated, created: false };
  }

  const contact: Contact = {
    id: newContactId(),
    name: input.name,
    phone: input.phone,
    digits,
    fields: input.fields,
    tags: input.tags,
    ...(input.notes ? { notes: input.notes } : {}),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.ref(`${base(tenantId)}/items/${contact.id}`).set(contact);
  await db.ref(`${base(tenantId)}/byDigits/${digits}`).set(contact.id);
  return { contact, created: true };
}

export async function deleteContact(tenantId: string, contactId: string): Promise<boolean> {
  const contact = await getContact(tenantId, contactId);
  if (!contact) return false;
  await db.ref(`${base(tenantId)}/items/${contactId}`).remove();
  await db.ref(`${base(tenantId)}/byDigits/${contact.digits}`).remove();
  return true;
}

/** Contacts carrying any of the given tags, deduped by digits. */
export async function contactsByTags(tenantId: string, tags: string[]): Promise<Contact[]> {
  const all = await listContacts(tenantId);
  const want = new Set(tags);
  return all.filter((c) => c.tags.some((t) => want.has(t)));
}
