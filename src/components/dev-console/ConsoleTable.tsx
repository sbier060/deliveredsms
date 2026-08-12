'use client';

import Link from 'next/link';

export const CONSOLE_MONO =
  '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';

export function PageHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-[22px] tracking-[-0.02em] text-[#EFEEEC]">{title}</h1>
      <p className="mt-1.5 text-[14px] leading-[1.6] text-[#918E86]">{subtitle}</p>
    </div>
  );
}

export function EmptyState({
  message,
  ctaHref,
  ctaLabel,
}: {
  message: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-[#2E2C28] bg-[#0F0E0C] px-5 py-10 text-center">
      <p className="text-[14px] text-[#918E86]">{message}</p>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="mt-4 inline-block rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86]"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

/** Status pill — accent reserved for failures, per the one-loud-thing rule. */
export function StatusPill({ status }: { status: string }) {
  const failed = status === 'failed';
  return (
    <span
      className={`rounded-md border px-1.5 py-0.5 text-[11px] ${
        failed
          ? 'border-[#5C2E10] bg-[#180C04] text-[#C9C6BF]'
          : 'border-[#2C2C2E] bg-[#1C1C1E] text-[#918E86]'
      }`}
    >
      {status}
    </span>
  );
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
