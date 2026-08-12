import Link from 'next/link';

/**
 * Footer for the developer surface. Deliberately NOT MarketingFooter — the
 * API side and the consumer side are separate products and must not
 * cross-link (Alek, 2026-08-08). Everything here stays inside /developers,
 * the agent surfaces, or legal pages that both products share.
 */

const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: 'Product',
    links: [
      { label: 'Docs', href: '/docs/quickstart' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Console', href: '/console' },
      { label: 'Changelog', href: '/docs/changelog' },
    ],
  },
  {
    title: 'For agents',
    links: [
      { label: 'AI agents', href: '/agents' },
      { label: 'llms.txt', href: '/llms.txt' },
      { label: 'MCP server', href: '/.well-known/mcp.json' },
      { label: 'Skills', href: 'https://github.com/sbier060/deliveredsms' },
    ],
  },
  {
    title: 'API',
    links: [
      { label: 'OpenAPI spec', href: '/api/v1/openapi.yaml' },
      { label: 'Errors', href: '/docs/errors' },
      { label: 'Sandbox', href: '/docs/sandbox' },
      { label: 'Migrate from Twilio', href: '/docs/migrate-from-twilio' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Privacy choices', href: '/privacy-choices' },
    ],
  },
];

export default function DevFooter() {
  return (
    <footer className="border-t border-[#2E2C28]">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          {COLUMNS.map(({ title, links }) => (
            <div key={title}>
              <p className="text-[12px] uppercase tracking-[0.1em] text-[#918E86]">
                {title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-[14px] text-[#C9C6BF] transition-colors duration-150 hover:text-[#EFEEEC]"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-12 text-[13px] text-[#918E86]">
          © {new Date().getFullYear()} Truelabel LLC, d/b/a Delivered
        </p>
      </div>
    </footer>
  );
}
