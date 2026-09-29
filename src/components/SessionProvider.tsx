'use client';

/**
 * SessionProvider
 *
 * Mounts a Supabase auth state listener that:
 *  1. Keeps the server-side httpOnly cookies in sync when Supabase auto-refreshes
 *     the access token on the client (TOKEN_REFRESHED event).
 *  2. Redirects to /login when the session truly expires (SIGNED_OUT event).
 *
 * Render this once, high in the component tree (e.g. in the root layout).
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        // Supabase JS has silently refreshed the access token.
        // Sync the new tokens back to the server-side httpOnly cookies so that
        // any server-rendered page or middleware check stays consistent.
        try {
          await fetch('/api/auth/refresh-session', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            }),
          });
        } catch {
          // Best-effort — the in-memory session is the source of truth for API
          // calls via fetchWithAuth, so a cookie sync failure is non-fatal.
        }
      }

      if (event === 'SIGNED_OUT') {
        // The refresh token has been invalidated or the user signed out elsewhere.
        // Redirect to login so the user can re-authenticate gracefully.
        router.push('/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return <>{children}</>;
}
