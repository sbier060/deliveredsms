import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { generateMetadata as buildMetadata } from '@/lib/metadata';
import DocsMarkdown from '@/components/dev-docs/DocsMarkdown';
import { DOCS_PAGES, getDocsPage } from '@/lib/dev-docs/content';

export function generateStaticParams() {
  return DOCS_PAGES.filter((p) => p.slug !== 'quickstart').map((p) => ({
    slug: p.slug,
  }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const page = getDocsPage(params.slug);
  if (!page) return {};
  return buildMetadata({
    title: `${page.title} | OpenSMS Docs`,
    description: page.description,
    path: `/docs/${page.slug}`,
  });
}

export default function DocsPage({ params }: { params: { slug: string } }) {
  const page = getDocsPage(params.slug);
  if (!page || page.slug === 'quickstart') notFound();
  return (
    <article>
      <DocsMarkdown markdown={page.markdown} />
    </article>
  );
}
