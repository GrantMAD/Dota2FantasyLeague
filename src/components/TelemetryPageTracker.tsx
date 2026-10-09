'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { createPageViewEvent } from '@/lib/telemetry';

export function TelemetryPageTracker() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastTrackedPath.current === pathname) return;
    lastTrackedPath.current = pathname;

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return;
      const event = createPageViewEvent(pathname, crypto.randomUUID());
      if (!event) return;

      void fetch('/api/telemetry/events', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
        keepalive: true,
      }).then((response) => {
        if (!response.ok) console.warn(`[Telemetry] Page view was not recorded (status ${response.status}).`);
      }).catch(() => {
        console.warn('[Telemetry] Page view could not be sent.');
      });
    }).catch(() => {
      console.warn('[Telemetry] Unable to read the current session for page telemetry.');
    });
  }, [pathname]);

  return null;
}
