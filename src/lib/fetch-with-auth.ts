import { supabase } from '@/lib/supabase';

/**
 * A drop-in replacement for fetch() that automatically attaches the current
 * Supabase access token as an Authorization: Bearer header.
 *
 * Token resolution order:
 *  1. supabase.auth.getSession() — in-memory/localStorage token (set via setSession() at login).
 *     Supabase JS v2 automatically refreshes an expired access token if a valid
 *     refresh token is present, so this is the primary and reliable source.
 *
 * If getSession returns no token (e.g. after a hard reload before the local
 * session is re-seeded) an explicit refreshSession() call is attempted first.
 *
 * If the request returns 401 despite having a token, the session is force-refreshed
 * once, the client in-memory session is updated, and the request is retried before
 * propagating the error.
 *
 * NOTE: The sb-auth-token server cookie is marked httpOnly and is therefore NOT
 * readable via document.cookie.  Do not attempt to use it as a fallback here.
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const doRequest = async (retried = false): Promise<Response> => {
    // getSession() automatically refreshes an expired access token when a valid
    // refresh token is stored locally (Supabase JS v2 behaviour).
    const {
      data: { session },
    } = await supabase.auth.getSession();

    let token = session?.access_token;

    // If no session token is available yet and this is the first attempt,
    // try an explicit refresh. This handles hard reloads where getSession()
    // returns null before the local session storage is warmed up.
    if (!token && !retried) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session?.access_token) {
        await supabase.auth.setSession({
          access_token: refreshed.session.access_token,
          refresh_token: refreshed.session.refresh_token,
        });
        token = refreshed.session.access_token;
      }
    }

    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(input, { credentials: 'include', ...init, headers });

    // On 401, force a full session refresh and retry once with the new token.
    if (response.status === 401 && !retried) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session) {
        // Persist the refreshed session so the retry uses the new access token.
        await supabase.auth.setSession({
          access_token: refreshed.session.access_token,
          refresh_token: refreshed.session.refresh_token,
        });
      }
      return doRequest(true);
    }

    return response;
  };

  return doRequest();
}
