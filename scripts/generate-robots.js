const fs = require('fs');
const path = require('path');

const DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN || 'deliveredsms.com';

const robots = `User-agent: *
Allow: /
Disallow: /console
Disallow: /api/developers/
Disallow: /api/admin/

# Agent surfaces
# llms.txt: https://${DOMAIN}/llms.txt
# MCP: https://${DOMAIN}/.well-known/mcp.json

Sitemap: https://${DOMAIN}/sitemap.xml
`;

fs.writeFileSync(path.join(process.cwd(), 'public', 'robots.txt'), robots);
console.log('robots.txt written');
