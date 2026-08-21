'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { devFetch } from '@/lib/dev-console/api';
import { Mixpanel } from '@/lib/mixpanel';
import { PageHeading, EmptyState } from '@/components/dev-console/ConsoleTable';
import { parseCsv } from '@/lib/csv';

const MONO = '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';
const INPUT =
  'w-full rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3.5 py-2.5 text-[14px] text-[#F2F2F7] placeholder-[#8E8E93] outline-none transition-colors duration-150 focus:border-[#00D26A]';

interface Contact {
  id: string;
  name: string;
  phone: string;
  tags: string[];
  fields: Record<string, string>;
  notes?: string;
}

/** Map arbitrary CSV headers onto our fields; unknown headers become custom fields. */
function rowsFromCsv(text: string): Array<Record<string, unknown>> {
  const grid = parseCsv(text);
  if (grid.length < 2) return [];
  const headers = grid[0].map((h) => h.trim().toLowerCase());
  const nameIdx = headers.findIndex((h) => ['name', 'full name', 'contact'].includes(h));
  const phoneIdx = headers.findIndex((h) => ['phone', 'phone number', 'number', 'mobile', 'cell'].includes(h));
  const tagsIdx = headers.findIndex((h) => ['tags', 'groups', 'group'].includes(h));
  const notesIdx = headers.findIndex((h) => h === 'notes');

  return grid.slice(1).map((row) => {
    const fields: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (![nameIdx, phoneIdx, tagsIdx, notesIdx].includes(i) && h && row[i]) fields[h] = row[i];
    });
    return {
      name: nameIdx >= 0 ? row[nameIdx] : '',
      phone: phoneIdx >= 0 ? row[phoneIdx] : row[0],
      tags: tagsIdx >= 0 && row[tagsIdx] ? row[tagsIdx].split(/[;,]/).map((t) => t.trim()).filter(Boolean) : [],
      ...(notesIdx >= 0 && row[notesIdx] ? { notes: row[notesIdx] } : {}),
      fields,
    };
  });
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ name: '', phone: '', tags: '' });
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setContacts((await devFetch<{ contacts: Contact[] }>('/api/developers/contacts')).contacts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contacts');
    }
  }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => { if (u) void load(); }), [load]);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await devFetch('/api/developers/contacts', {
        method: 'POST',
        body: JSON.stringify({
          name: draft.name,
          phone: draft.phone,
          tags: draft.tags.split(/[;,]/).map((t) => t.trim()).filter(Boolean),
        }),
      });
      setDraft({ name: '', phone: '', tags: '' });
      setShowAdd(false);
      Mixpanel.track('Contact Created', { product: 'developer_api' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add contact');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await devFetch(`/api/developers/contacts/${id}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File) => {
    setBusy(true);
    setImportStatus('Parsing…');
    setError(null);
    try {
      const rows = rowsFromCsv(await file.text());
      if (rows.length === 0) {
        setImportStatus(null);
        setError('No rows found. The first line must be a header row including a phone column.');
        return;
      }
      let created = 0;
      let updated = 0;
      let skipped = 0;
      for (let i = 0; i < rows.length; i += 200) {
        setImportStatus(`Importing ${Math.min(i + 200, rows.length)}/${rows.length}…`);
        const res = await devFetch<{ created: number; updated: number; skipped: unknown[] }>(
          '/api/developers/contacts/import',
          { method: 'POST', body: JSON.stringify({ rows: rows.slice(i, i + 200) }) }
        );
        created += res.created;
        updated += res.updated;
        skipped += res.skipped.length;
      }
      setImportStatus(`Done: ${created} added, ${updated} updated${skipped ? `, ${skipped} skipped` : ''}.`);
      Mixpanel.track('Contacts Imported', { created, updated, skipped, product: 'developer_api' });
      await load();
    } catch (e) {
      setImportStatus(null);
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    // devFetch expects JSON; the export route streams CSV, so fetch directly.
    const user = auth.currentUser;
    if (!user) return;
    const res = await fetch('/api/developers/contacts/export', {
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resms-contacts.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error && !contacts) return <p className="text-[14px] text-[#C9C6BF]">{error}</p>;
  if (!contacts) return <p className="text-[14px] text-[#918E86]">Loading…</p>;

  const allTags = [...new Set(contacts.flatMap((c) => c.tags))].sort();
  const shown = contacts.filter((c) => {
    if (tag && !c.tags.includes(tag)) return false;
    if (!q) return true;
    const needle = q.toLowerCase();
    return c.name.toLowerCase().includes(needle) || c.phone.includes(needle.replace(/\D/g, '') || ' ');
  });

  return (
    <div>
      <PageHeading title="Contacts" subtitle={`${contacts.length} saved. Tags double as broadcast audiences.`} />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or number" className={`${INPUT} max-w-[240px]`} />
        {allTags.length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)} className="rounded-lg border border-[#2C2C2E] bg-[#1C1C1E] px-3 py-2 text-[14px] text-[#F2F2F7] outline-none focus:border-[#00D26A]">
            <option value="">All tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <div className="ml-auto flex items-center gap-3">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="text-[13px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC] disabled:opacity-30">Import CSV</button>
          <button onClick={() => void exportCsv()} disabled={busy || contacts.length === 0} className="text-[13px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC] disabled:opacity-30">Export</button>
          <button onClick={() => setShowAdd((s) => !s)} className="rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86]">Add contact</button>
        </div>
      </div>

      {importStatus && <p className="mt-3 text-[13px] text-[#918E86]">{importStatus}</p>}
      {error && <p className="mt-3 text-[13px] text-[#C9C6BF]">{error}</p>}

      {showAdd && (
        <div className="mt-4 space-y-3 rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-4">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" className={INPUT} />
          <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+1 (555) 123-4567" className={INPUT} />
          <input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="Tags (comma-separated)" className={INPUT} />
          <button onClick={add} disabled={busy || !draft.phone} className="rounded-full bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-7 py-[10px] text-[14px] text-white transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-30">Save contact</button>
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="mt-6">
          <EmptyState message="No contacts yet. Add one, or import a CSV with name and phone columns." />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-[#2E2C28]">
          <ul className="divide-y divide-[#2E2C28]">
            {shown.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 bg-[#0F0E0C] px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[15px] text-[#EFEEEC]">{c.name || '-'}</p>
                  <p className={`text-[13px] text-[#918E86] ${MONO}`}>{c.phone}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {c.tags.map((t) => (
                    <span key={t} className="rounded-full border border-[#2C2C2E] bg-[#1C1C1E] px-2.5 py-0.5 text-[11px] text-[#C9C6BF]">{t}</span>
                  ))}
                  <button onClick={() => void remove(c.id)} disabled={busy} className="ml-2 text-[13px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC] disabled:opacity-30">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
