import type { Metadata } from 'next';
import './globals.css';
import { generateMetadata as buildMetadata } from '@/lib/metadata';
import { organizationSchema, websiteSchema, siteNavigationSchema } from '@/lib/site-schema';

export const metadata: Metadata = buildMetadata({});

// Emitted server-side in the document rather than via next/script so crawlers
// see it in the raw HTML. afterInteractive scripts are not reliably read.
const SCHEMA = [organizationSchema(), websiteSchema(), siteNavigationSchema()];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {SCHEMA.map((schema, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
      </head>
      <body className="min-h-screen bg-[#0A0A0B] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
