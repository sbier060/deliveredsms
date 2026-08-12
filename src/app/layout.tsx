import type { Metadata } from 'next';
import './globals.css';
import { generateMetadata as buildMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildMetadata({});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0A0A0B] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
