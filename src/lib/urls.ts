/**
 * The ONE place Resms hostnames live. Every page, doc, snippet, skill, and
 * spec imports from here - the ghost-checkout era's ~60 scattered URL literals
 * are what made moving domains painful, and this file is the fix.
 *
 * NEXT_PUBLIC_SITE_DOMAIN lets previews and a future domain change happen
 * without a code edit; the default is the production domain.
 */

export const SITE_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN || 'resms.com';

/**
 * The Delivered-era domain. Every SDK and CLI published before the Resms
 * rebrand has `api.deliveredsms.com` compiled into it, and those installs are
 * never coming back for an upgrade - so the legacy apex and its api./mcp.
 * subdomains have to keep answering. The apex 308s to the new site (SEO
 * follows the redirect); the machine hosts serve the real thing in place,
 * because sending a POST body through a redirect hop is a needless way to
 * break someone's integration.
 */
export const LEGACY_SITE_DOMAIN = 'deliveredsms.com';

export const SITE_URL = `https://${SITE_DOMAIN}`;
export const API_URL = `https://api.${SITE_DOMAIN}`;
export const MCP_URL = `https://mcp.${SITE_DOMAIN}`;

export const SUPPORT_EMAIL = `support@${SITE_DOMAIN}`;
