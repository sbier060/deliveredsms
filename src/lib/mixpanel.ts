import mixpanel from 'mixpanel-browser';
import { hasTrackingConsent } from '@/lib/consent';

let initialized = false;

function ensureInit() {
  if (typeof window === 'undefined' || initialized) return;
  if (!process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) return;
  if (!hasTrackingConsent()) return;
  initialized = true;
  mixpanel.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN, {
    debug: process.env.NODE_ENV === 'development',
    track_pageview: true,
    persistence: 'localStorage',
    // First-party proxy (vercel.json rewrites /mp/* -> api.mixpanel.com).
    // Developers are the highest ad-blocker demographic; without this the
    // funnel undercounts exactly the users this product measures.
    api_host: `${window.location.origin}/mp`,
  });
}

export const Mixpanel = {
  identify: (id: string) => {
    ensureInit();
    if (initialized) mixpanel.identify(id);
  },
  track: (name: string, props?: Record<string, unknown>) => {
    ensureInit();
    if (initialized) mixpanel.track(name, props);
  },
  people: {
    set: (props: Record<string, unknown>) => {
      ensureInit();
      if (initialized) mixpanel.people.set(props);
    },
  },
};
