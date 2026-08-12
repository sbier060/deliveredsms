import type { Metadata } from 'next';
import ConsoleShell from './ConsoleShell';

export const metadata: Metadata = {
  title: 'Console | OpenSMS',
  robots: 'noindex, nofollow',
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
