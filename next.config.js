/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // firebase@10 pulls undici, whose private-field syntax (#target in this)
    // Next 13.4's webpack can't parse. Firebase auth falls back to the
    // platform fetch without it. Same workaround the platform shipped with
    // in its first life.
    config.resolve.alias = {
      ...config.resolve.alias,
      undici: false,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          // api. and mcp. carry real traffic, so the apex policy has to cover
          // subdomains or each one has to earn HSTS independently on first hit.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
      // The API hosts are machine surfaces. Belt-and-braces with the
      // robots.txt in middleware: a header travels with every response,
      // including the JSON index at api./ that would otherwise be indexable.
      // The deliveredsms.com pair are the Delivered-era hosts, kept alive for
      // SDKs published before the Resms rebrand - they serve the same machine
      // surface, so they need the same noindex.
      ...['api.resms.com', 'mcp.resms.com', 'api.deliveredsms.com', 'mcp.deliveredsms.com'].map(
        (value) => ({
          source: '/:path*',
          has: [{ type: 'host', value }],
          headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
        })
      ),
    ];
  },
};
module.exports = nextConfig;
