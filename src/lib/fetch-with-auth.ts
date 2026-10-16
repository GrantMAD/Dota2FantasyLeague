import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

let refreshSessionPromise: Promise<Session | null> | null = null;

/**
 * Bootstrap the client-side Supabase in-memory session by asking the server
 * to exchange the httpOnly `sb-refresh-token` cookie for a new access token.
 *
 * This is necessary because the browser-side Supabase JS client cannot read
 * httpOnly cookies directly. After a hard reload or cold dev-server start the
 * in-memory session is empty even though the user's refresh token is safely
 * stored in a cookie — this call bridges that gap.
 */
async function bootstrapSessionFromServer(): Promise<Session | null> {
  try {
    const res = await fetch('/api/auth/session', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;

    const { access_token, refresh_token } = (await res.json()) as {
      access_token: string;
      refresh_token: string;
    };
    if (!access_token || !refresh_token) return null;

    // Seed the Supabase JS client's in-memory session so that subsequent
    // getSession() calls return a valid token without another round-trip.
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error || !data.session) return null;
    return data.session;
  } catch {
    return null;
  }
}

async function refreshClientSession(): Promise<Session | null> {
  if (!refreshSessionPromise) {
    refreshSessionPromise = (async () => {
      // First try to bootstrap from the server cookie — this handles the
      // hard-reload / cold-start case where the JS client has no in-memory
      // session but the user IS logged in (refresh token lives in httpOnly cookie).
      const bootstrapped = await bootstrapSessionFromServer();
      if (bootstrapped) return bootstrapped;

      // Fallback: client-side Supabase refresh (works when the JS client
      // already has a refresh token in memory / localStorage).
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) return null;

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (setSessionError) return null;
      return data.session;
    })().finally(() => {
      refreshSessionPromise = null;
    });
  }
  return refreshSessionPromise;
}

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
 * session is re-seeded) an explicit refresh is attempted first:
 *  2a. Server-side session bootstrap via GET /api/auth/session — reads the
 *      httpOnly sb-refresh-token cookie and returns a fresh token pair, which
 *      is then seeded into the in-memory client via setSession().
 *  2b. Client-side supabase.auth.refreshSession() fallback.
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
  const traceId = crypto.randomUUID();
  const doRequest = async (retried = false): Promise<Response> => {
    // getSession() automatically refreshes an expired access token when a valid
    // refresh token is stored locally (Supabase JS v2 behaviour).
    const {
      data: { session },
    } = await supabase.auth.getSession();

    let token = session?.access_token;

    // If no session token is available yet and this is the first attempt,
    // try an explicit refresh. This handles hard reloads where getSession()
    // returns null before the local session storage is warmed up, as well as
    // cold dev-server starts where the httpOnly cookie holds the refresh token
    // but the JS client has no in-memory session yet.
    if (!token && !retried) {
      const refreshed = await refreshClientSession();
      token = refreshed?.access_token;
    }

    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    headers.set('x-request-id', traceId);
    if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(input, { credentials: 'include', ...init, headers });

    // On 401, force a full session refresh and retry once with the new token.
    if (response.status === 401 && !retried) {
      const refreshed = await refreshClientSession();
      if (refreshed?.access_token) return doRequest(true);
    }

    return response;
  };

  return doRequest();
}
