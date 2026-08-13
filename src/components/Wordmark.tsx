/**
 * The Delivered wordmark. One definition so size, weight, and the accent-green
 * period stay identical everywhere - it was duplicated across nine files and
 * had already drifted to two different sizes.
 *
 * Tracking is tightened slightly: at 600 the letterforms are heavier and
 * default spacing reads loose.
 */

const SIZES = {
  lg: 'text-[24px]',
  md: 'text-[22px]',
} as const;

export default function Wordmark({
  size = 'lg',
  suffix,
}: {
  size?: keyof typeof SIZES;
  /** Section label rendered next to the mark, e.g. "Docs" or "Console". */
  suffix?: string;
}) {
  return (
    <>
      <span
        className={`${SIZES[size]} font-semibold tracking-[-0.02em] text-[#EFEEEC]`}
      >
        Delivered<span className="text-[#00D26A]">.</span>
      </span>
      {suffix && <span className="text-[15px] text-[#918E86]">{suffix}</span>}
    </>
  );
}
