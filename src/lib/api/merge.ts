import { db } from '@/lib/firebase-admin';
import { randomBase62 } from './ids';
import type { Contact } from './contacts';

/**
 * Message templates and merge fields, shared by 1:1 compose and broadcasts.
 *
 *   apiTemplates/{tenantId}/{templateId} = { name, body, createdAt }
 *
 * Merge syntax: {{name}}, {{first_name}}, {{phone}}, {{field:company}}.
 * Unresolvable fields render as an empty string, never as the raw tag - a
 * customer must not receive "Hi {{first_name}}".
 */

export interface Template {
  id: string;
  name: string;
  body: string;
  createdAt: number;
}

export const newTemplateId = () => `tpl_${randomBase62(12)}`;
export const MAX_TEMPLATES = 100;

export async function listTemplates(tenantId: string): Promise<Template[]> {
  const snap = await db.ref(`apiTemplates/${tenantId}`).get();
  if (!snap.exists()) return [];
  return (Object.values(snap.val()) as Template[]).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createTemplate(
  tenantId: string,
  name: string,
  body: string
): Promise<Template> {
  const template: Template = { id: newTemplateId(), name, body, createdAt: Date.now() };
  await db.ref(`apiTemplates/${tenantId}/${template.id}`).set(template);
  return template;
}

export async function deleteTemplate(tenantId: string, templateId: string): Promise<void> {
  await db.ref(`apiTemplates/${tenantId}/${templateId}`).remove();
}

export function renderMerge(body: string, contact: Contact | null): string {
  return body.replace(/\{\{\s*([a-z_]+)(?::([a-zA-Z0-9_ -]+))?\s*\}\}/g, (_, tag: string, arg?: string) => {
    if (!contact) return '';
    switch (tag) {
      case 'name':
        return contact.name || '';
      case 'first_name':
        return (contact.name || '').split(/\s+/)[0] || '';
      case 'phone':
        return contact.phone;
      case 'field':
        return (arg && contact.fields[arg.trim()]) || '';
      default:
        return '';
    }
  });
}
