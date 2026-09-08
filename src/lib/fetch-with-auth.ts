import { supabase } from '@/lib/supabase';

/**
 * A drop-in replacement for fetch() that automatically attaches the current
 * Supabase access token as an Authorization: Bearer header.
 *
 * Token resolution order:
 *  1. supabase.auth.getSession() — localStorage token (set via setSession() at login)
 *  2. document.cookie fallback    — sb-auth-token cookie (bridge for sessions that
 *                                   pre-date the setSession() fix, or after a hard refresh)
 *
 * If the request returns 401, the session is force-refreshed once and the request
 * is retried automatically before propagating the error.
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const doRequest = async (retried = false): Promise<Response> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    let token = session?.access_token;

    // Fallback: read the auth cookie the server set at login time.
    // This covers cases where the Supabase client was never seeded via setSession().
    if (!token && typeof document !== 'undefined') {
      token = document.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('sb-auth-token='))
        ?.slice('sb-auth-token='.length);
    }

    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(input, { credentials: 'include', ...init, headers });

    // On 401, force a session refresh and retry once.
    if (response.status === 401 && !retried) {
      await supabase.auth.refreshSession();
      return doRequest(true);
    }

    return response;
  };

  return doRequest();
}
