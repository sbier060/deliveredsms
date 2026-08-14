/**
 * Site-wide CTA button anatomy, copied from Resend's buttons (sizing, radius,
 * weight, layout) with our green fill in place of their glassy white:
 * section CTAs are h-12 / px-5 / text-base / font-semibold / rounded-2xl,
 * the header CTA is the smaller h-10 / px-4 / text-sm variant, and the
 * secondary is their transparent "Documentation" ghost button.
 * The primary label is always "Get started".
 */

export const PRIMARY_CTA =
  'inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-5 text-base font-semibold text-white transition-[opacity,transform] duration-200 ease-out-strong hover:opacity-90 motion-safe:active:scale-[0.97]';

export const SECONDARY_CTA =
  'inline-flex h-12 items-center justify-center gap-1 rounded-2xl px-5 text-base font-semibold text-[#918E86] transition-colors duration-200 hover:text-[#EFEEEC]';

export const HEADER_CTA =
  'inline-flex h-10 items-center justify-center whitespace-nowrap rounded-2xl bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-4 text-sm font-semibold text-white transition-[opacity,transform] duration-200 ease-out-strong hover:opacity-90 motion-safe:active:scale-[0.97]';
