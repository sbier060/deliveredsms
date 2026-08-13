'use client';

import { useEffect } from 'react';
import { Mixpanel } from '@/lib/mixpanel';

/**
 * Top-of-funnel beacon for the developer API.
 *
 * The /developers pages are server components, so this tiny client island is
 * how they emit a Mixpanel event. One explicit named event per page - the
 * funnel (Landing Viewed → Signup → First Call) needs stable event names, not
 * generic autotracked pageviews.
 */
export default function DevFunnelTracker({ event }: { event: string }) {
  useEffect(() => {
    Mixpanel.track(event, { product: 'developer_api' });
  }, [event]);
  return null;
}
