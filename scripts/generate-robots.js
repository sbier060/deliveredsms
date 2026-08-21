const fs = require('fs');
const path = require('path');
const { KEY, KEY_FILE } = require('./indexnow');

const DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN || 'resms.com';

const robots = `User-agent: *
Allow: /
Disallow: /console
Disallow: /api/developers/
Disallow: /api/admin/

# Agent surfaces
# llms.txt: https://${DOMAIN}/llms.txt
# Markdown twin of any page: append .md to its URL (or send Accept: text/markdown)
# MCP: https://${DOMAIN}/.well-known/mcp.json
# Skills: https://${DOMAIN}/.well-known/agent-skills/index.json

Sitemap: https://${DOMAIN}/sitemap.xml
`;

fs.writeFileSync(path.join(process.cwd(), 'public', 'robots.txt'), robots);

// The IndexNow key file, generated from the one literal scripts/indexnow.js
// submits with. Written here rather than committed by hand because the failure
// mode when the two drift is a silent 403 on every submission, with nothing else
// in the system noticing: the build passes, the deploy works, and the pages just
// quietly stop being announced.
fs.writeFileSync(path.join(process.cwd(), 'public', KEY_FILE), KEY);

console.log(`robots.txt + ${KEY_FILE} written`);
