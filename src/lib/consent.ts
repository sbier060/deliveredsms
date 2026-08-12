const CONSENT_COOKIE = 'osms_tracking_consent';
const GEO_COOKIE = 'osms_geo_requires_consent';
const GEO_DETECTION_FAILED_COOKIE = 'osms_geo_detection_failed';

export type ConsentStatus = 'accepted' | 'declined' | 'pending';

const EU_EEA_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', // EEA
  'GB', // UK GDPR
  'CH', // Switzerland
]);

const US_CONSENT_STATES = new Set(['CA', 'FL', 'PA']);

export function requiresConsent(country: string, region?: string): boolean {
  if (EU_EEA_COUNTRIES.has(country)) return true;
  if (country === 'US' && region && US_CONSENT_STATES.has(region)) return true;
  return false;
}

export function resolveGeoConsentRequirement(
  country: string,
  region?: string
): { requiresConsent: boolean; geoDetectionFailed: boolean } {
  const geoDetectionFailed = !country;
  if (geoDetectionFailed) {
    return { requiresConsent: true, geoDetectionFailed: true };
  }
  return { requiresConsent: requiresConsent(country, region), geoDetectionFailed: false };
}

export function getGeoDetectionFailed(): boolean | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`${GEO_DETECTION_FAILED_COOKIE}=([^;]+)`));
  if (!match) return null;
  return match[1] === '1';
}

export function getConsentStatus(): ConsentStatus {
  if (typeof document === 'undefined') return 'pending';
  const match = document.cookie.match(new RegExp(`${CONSENT_COOKIE}=([^;]+)`));
  return (match?.[1] as ConsentStatus) || 'pending';
}

export function setConsentStatus(status: 'accepted' | 'declined'): void {
  const maxAge = 365 * 24 * 60 * 60;
  document.cookie = `${CONSENT_COOKIE}=${status}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function getGeoRequiresConsent(): boolean | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`${GEO_COOKIE}=([^;]+)`));
  if (!match) return null;
  return match[1] === '1';
}

export function hasTrackingConsent(): boolean {
  // An explicit decline (Reject All on /privacy-choices) is honored everywhere,
  // even in regions where consent isn't geo-required — several US states have
  // opt-out laws, and the privacy policy promises the opt-out works.
  if (getConsentStatus() === 'declined') return false;
  const geoRequired = getGeoRequiresConsent();
  if (geoRequired === false) return true;
  if (geoRequired === null) return false;
  return getConsentStatus() === 'accepted';
}

const CHECKOUT_FUNNEL_PREFIXES = [
  '/scan',
  '/onboarding',
  '/number-onboarding',
  '/number-selection',
  '/get-started',
  '/upsell-web',
  '/vpn-upgrade',
  '/spam-blocker-upgrade',
  '/chat-upgrade',
  '/confirmation',
  '/portal-redirect',
];

export function isCheckoutFunnelPath(pathname: string): boolean {
  return CHECKOUT_FUNNEL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  );
}
