/**
 * Shared heading -> anchor id slugifier. Lives in its own module so the
 * client-side markdown renderer can import it without dragging the whole
 * docs content bundle into the client build.
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_{}[\]()#+.,:;!?'"&$/\\]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
