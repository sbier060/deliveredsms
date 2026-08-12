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
        ],
      },
    ];
  },
};
module.exports = nextConfig;
