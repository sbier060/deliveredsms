import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/urls';

export const BASE_URL = SITE_URL;

const SITE_TITLE = 'OpenSMS — SMS & Phone Verification API';
const DEFAULT_DESCRIPTION =
  'Programmable SMS, phone verification, and real US/Canada phone numbers with one REST API. Built for developers and AI agents. Free sandbox, no card.';

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
  const fullTitle = title ? `${title} | OpenSMS` : SITE_TITLE;

  return {
    title: fullTitle,
    description: description || DEFAULT_DESCRIPTION,
    metadataBase: new URL(BASE_URL),
    alternates: { canonical: canonicalUrl },
    robots: noindex ? 'noindex, nofollow' : 'index, follow',
    keywords: keywords.join(', '),
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      title: fullTitle,
      description: description || DEFAULT_DESCRIPTION,
      siteName: 'OpenSMS',
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: 'summary',
      title: fullTitle,
      description: description || DEFAULT_DESCRIPTION,
    },
  };
}
