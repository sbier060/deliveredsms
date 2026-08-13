import { SITE_URL } from '@/lib/urls';
import { COMPANY } from '@/lib/legal';

/**
 * Structured data for the brand SERP.
 *
 * Google chooses sitelinks (the sub-rows under a brand result) algorithmically,
 * so none of this declares them. What it does is give Google the three signals
 * it actually reads when picking them: an Organization it can attach the brand
 * to, a WebSite it can attach a search box to, and an explicit list of the
 * primary navigation destinations. Everything named in SITE_NAV must be a real,
 * indexable page with its own title and description, linked from the homepage
 * nav and present in the sitemap. That is the whole lever.
 */

/** The pages we want treated as the site's primary sections. */
export const SITE_NAV = [
  { name: 'SMS for developers', path: '/', description: 'Send and receive SMS, verify phone numbers, and provision real US and Canada numbers with one REST API.' },
  { name: 'Pricing', path: '/pricing', description: 'Usage-based pricing with no platform fee. Free sandbox, no card required.' },
  { name: 'Documentation', path: '/docs', description: 'Quickstart, API reference, webhooks, and migration guides.' },
  { name: 'Log in', path: '/login', description: 'Log in to the Delivered console to manage API keys, numbers, and usage.' },
  { name: 'Create an account', path: '/signup', description: 'Create a free Delivered account and get a sandbox API key instantly.' },
] as const

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'Delivered',
    legalName: COMPANY.legalName,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    description:
      'Programmable SMS, phone verification, and real US and Canada phone numbers with one REST API.',
    sameAs: ['https://github.com/sbier060/deliveredsms'],
  }
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: 'Delivered',
    url: SITE_URL,
    publisher: { '@id': `${SITE_URL}/#organization` },
  }
}

/** Names the primary sections so Google has an explicit nav to draw from. */
export function siteNavigationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: SITE_NAV.map((item, i) => ({
      '@type': 'SiteNavigationElement',
      position: i + 1,
      name: item.name,
      description: item.description,
      url: `${SITE_URL}${item.path === '/' ? '' : item.path}`,
    })),
  }
}
