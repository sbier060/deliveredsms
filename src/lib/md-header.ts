import { SITE_URL } from '@/lib/urls';

/**
 * The provenance block every markdown twin opens with, directly under its H1.
 *
 * A twin does not get read in place. It gets pulled out of llms-full.txt,
 * pasted into a context window, cached by a crawler, handed to a model weeks
 * later. Nothing in the file said which page it was a twin OF, so "is this
 * current, and where is the canonical version" was unanswerable from the file
 * itself — and the twins are the surface an assistant quotes.
 *
 * Same three lines the whole property uses, so the shape is learnable:
 *
 *   Source: https://deliveredsms.com/docs/verify
 *   Index: https://deliveredsms.com/llms.txt
 *
 * `Index` points at the file to fetch NEXT if the twin is not the answer. That
 * is Resend's convention (they lead their markdown with a pointer to their docs
 * index) and it costs one line.
 */
export function mdHeader(path: string, updated?: string): string {
  const url = `${SITE_URL}${path === '/' ? '' : path}`;
  return [`Source: ${url}`, updated ? `Updated: ${updated}` : null, `Index: ${SITE_URL}/llms.txt`]
    .filter(Boolean)
    .join('\n');
}

/**
 * Insert the header into a markdown body, immediately after its H1.
 *
 * After the H1 rather than before it, because a leading metadata block pushes
 * the title out of the first line and some readers use the first line as the
 * document name. If the body has no H1 the header goes on top, which is still
 * better than nowhere.
 */
export function withMdHeader(body: string, path: string, updated?: string): string {
  const header = mdHeader(path, updated);
  const lines = body.split('\n');
  const h1 = lines.findIndex((l) => l.startsWith('# '));
  if (h1 === -1) return `${header}\n\n${body}`;
  // Skip a blank line the body may already have after its H1, so the result is
  // never "H1, blank, blank, header".
  const rest = lines.slice(h1 + 1);
  while (rest.length && rest[0].trim() === '') rest.shift();
  return [...lines.slice(0, h1 + 1), '', header, '', ...rest].join('\n');
}
