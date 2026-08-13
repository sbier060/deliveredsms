/**
 * Search index for the docs command palette (server-built, shipped as a prop).
 * One entry per docs page; sections split on h2 headings so results can deep
 * link to the exact anchor DocsMarkdown renders.
 */
import { DOCS_PAGES } from './content';
import { slugifyHeading } from './heading-anchor';

export interface DocsSearchSection {
  heading: string | null;
  anchor: string | null;
  text: string;
}

export interface DocsSearchEntry {
  href: string;
  title: string;
  description: string;
  sections: DocsSearchSection[];
}

function compact(md: string): string {
  return md
    .replace(/```[a-z]*\n?/g, ' ')
    .replace(/[|*_>`#]/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildDocsIndex(): DocsSearchEntry[] {
  const entries: DocsSearchEntry[] = DOCS_PAGES.map((page) => {
    const sections: DocsSearchSection[] = [];
    let current: DocsSearchSection = { heading: null, anchor: null, text: '' };
    for (const line of page.markdown.split('\n')) {
      const m = /^##\s+(.+)$/.exec(line);
      if (m) {
        if (current.text.trim() || current.heading) sections.push(current);
        const heading = m[1].replace(/`/g, '').trim();
        current = { heading, anchor: slugifyHeading(heading), text: '' };
      } else if (!line.startsWith('# ')) {
        current.text += `${line}\n`;
      }
    }
    if (current.text.trim() || current.heading) sections.push(current);
    for (const s of sections) s.text = compact(s.text);
    return {
      href: `/docs/${page.slug}`,
      title: page.title,
      description: page.description,
      sections,
    };
  });

  entries.push(
    {
      href: '/openapi.json',
      title: 'OpenAPI spec (JSON)',
      description: 'Machine-readable spec of every endpoint.',
      sections: [],
    },
    {
      href: '/docs/llms-full.txt',
      title: 'llms-full.txt',
      description: 'Every docs page concatenated for AI agents.',
      sections: [],
    },
    {
      href: '/console',
      title: 'Console',
      description: 'API keys, usage, inbox, and account settings.',
      sections: [],
    }
  );
  return entries;
}
