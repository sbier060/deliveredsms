import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/urls';

export const BASE_URL = SITE_URL;

// "Brand · Tagline" is the shape Google renders as the headline of a brand
// result (resend.com uses "Resend · Email for developers"). Keep it short: the
// homepage title is the anchor for every branded search.
const SITE_TITLE = 'Resms · SMS for developers';
const DEFAULT_DESCRIPTION =
  'Programmable SMS, phone verification, and real US/Canada phone numbers with one REST API. Built for developers and AI agents. Free sandbox, no card.';

// The social card. One static file rather than a per-route ImageResponse: it is
// one fetch for a crawler, it cannot fail at request time, and `curl -I` after a
// deploy tells you it is there. Regenerate with scripts/make-og-image.js.
const OG_IMAGE = '/og.png';

// Every page has a markdown twin. The convention is the path plus `.md` (the
// landing page's is /index.md), and rel="alternate" is how a crawler that only
// has the HTML discovers it without being told the rule. Content negotiation
// exists too, but it requires the client to know to ask.
function markdownTwin(normalizedPath: string): string {
  return normalizedPath === '' ? '/index.md' : `${normalizedPath}.md`;
}

export interface PageMetadataProps {
  title?: string;
  description?: string;
  path?: string;
  noindex?: boolean;
  ogImage?: string;
  keywords?: string[];
}

export function generateMetadata(props: PageMetadataProps): Metadata {
  const { title, description, path, noindex = false, ogImage, keywords = [] } = props;

  const normalizedPath =
    !path || path === '/' ? '' : path.endsWith('/') ? path.slice(0, -1) : path;
  const canonicalUrl = `${BASE_URL}${normalizedPath}` || BASE_URL;
  const fullTitle = title ? `${title} | Resms` : SITE_TITLE;

  return {
    title: fullTitle,
    description: description || DEFAULT_DESCRIPTION,
    metadataBase: new URL(BASE_URL),
    alternates: {
      canonical: canonicalUrl,
      types: { 'text/markdown': `${BASE_URL}${markdownTwin(normalizedPath)}` },
    },
    robots: noindex ? 'noindex, nofollow' : 'index, follow',
    keywords: keywords.join(', '),
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      title: fullTitle,
      description: description || DEFAULT_DESCRIPTION,
      siteName: 'Resms',
      // Every page had og:title and og:description and NO image, so every link
      // to a doc page unfurled in Slack and iMessage as a grey box with a
      // hostname — for a product whose docs get pasted between developers all
      // day. A per-page override is still honoured.
      images: [{ url: ogImage ?? OG_IMAGE, width: 1200, height: 630 }],
    },
    twitter: {
      // summary_large_image, not summary: with an image to show, the small card
      // crops it to a thumbnail beside the text.
      card: 'summary_large_image',
      title: fullTitle,
      description: description || DEFAULT_DESCRIPTION,
      images: [ogImage ?? OG_IMAGE],
    },
  };
}
