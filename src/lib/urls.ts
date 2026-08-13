/**
 * The ONE place Delivered hostnames live. Every page, doc, snippet, skill, and
 * spec imports from here - the ghost-checkout era's ~60 scattered URL literals
 * are what made moving domains painful, and this file is the fix.
 *
 * NEXT_PUBLIC_SITE_DOMAIN lets previews and a future domain change happen
 * without a code edit; the default is the production domain.
 */

export const SITE_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN || 'deliveredsms.com';

export const SITE_URL = `https://${SITE_DOMAIN}`;
export const API_URL = `https://api.${SITE_DOMAIN}`;
export const MCP_URL = `https://mcp.${SITE_DOMAIN}`;

export const SUPPORT_EMAIL = `support@${SITE_DOMAIN}`;
