/**
 * Staging & Production Smoke Test Suite
 *
 * Verifies live service integration across:
 *  - Public route connectivity (landing, login)
 *  - Security barriers (unauthenticated access to protected APIs rejected with 401)
 *  - Cron route authorization (unauthorized cron rejected, authorized cron executed)
 *  - Real Supabase authentication (signin with live credentials)
 *  - Real database read (fetch user profile from Supabase)
 *  - Real database mutation & reversion (non-destructive update of manager bio)
 *  - Token lifecycle (session refresh endpoint and cookie exchange)
 *  - Sign-out (session destruction and cookie clearance)
 *
 * Usage:
 *   npx tsx scripts/smoke-test.ts
 *   npx tsx scripts/smoke-test.ts --url=http://localhost:3000
 *   SMOKE_USER_EMAIL=test@example.com SMOKE_USER_PASSWORD=secret npx tsx scripts/smoke-test.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment files
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

// Parse CLI arguments
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = args.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

const BASE_URL = (
  getArg('url') ||
  process.env.SMOKE_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://dota2-fantasy-league-dusky.vercel.app'
).replace(/\/$/, '');

const TEST_EMAIL =
  getArg('email') ||
  process.env.SMOKE_USER_EMAIL ||
  process.env.TEST_USER_EMAIL;

const TEST_PASSWORD =
  getArg('password') ||
  process.env.SMOKE_USER_PASSWORD ||
  process.env.TEST_USER_PASSWORD;

const CRON_SECRET =
  getArg('cron-secret') ||
  process.env.CRON_SECRET;

// State tracking
let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;

// Cookie jar for maintaining session across fetch calls
const cookieJar = new Map<string, string>();

function updateCookieJar(response: Response) {
  if (typeof response.headers.getSetCookie === 'function') {
    const setCookies = response.headers.getSetCookie();
    for (const cookieStr of setCookies) {
      const parts = cookieStr.split(';')[0].split('=');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (value === '' || cookieStr.includes('Max-Age=0') || cookieStr.includes('max-age=0')) {
          cookieJar.delete(name);
        } else {
          cookieJar.set(name, value);
        }
      }
    }
  }
}

function getCookieHeader(): string {
  return Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});

  const cookieHeader = getCookieHeader();
  if (cookieHeader && !headers.has('Cookie')) {
    headers.set('Cookie', cookieHeader);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    redirect: 'manual',
  });

  updateCookieJar(response);
  return response;
}

async function runStep(name: string, fn: () => Promise<void>) {
  const startTime = Date.now();
  process.stdout.write(`  ⏳ ${name}... `);
  try {
    await fn();
    const elapsed = Date.now() - startTime;
    console.log(`\x1b[32mPASSED\x1b[0m (${elapsed}ms)`);
    testsPassed++;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`\x1b[31mFAILED\x1b[0m (${elapsed}ms)`);
    console.error(`     \x1b[31mError:\x1b[0m ${error instanceof Error ? error.message : String(error)}`);
    testsFailed++;
  }
}

function skipStep(name: string, reason: string) {
  console.log(`  ⏭️  ${name}... \x1b[33mSKIPPED\x1b[0m (${reason})`);
  testsSkipped++;
}

// ---------------------------------------------------------------------------
// Test Execution
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n======================================================');
  console.log(' 🚀 DOTA 2 FANTASY LEAGUE — STAGING SMOKE TEST SUITE');
  console.log('======================================================');
  console.log(`Target URL : ${BASE_URL}`);
  console.log(`Test User  : ${TEST_EMAIL || '(Not configured — auth tests will be skipped)'}`);
  console.log(`Timestamp  : ${new Date().toISOString()}\n`);

  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let originalBio: string | null = null;

  // 1. Connectivity & Public Pages
  console.log('\x1b[1m[Suite 1: Public Pages & Connectivity]\x1b[0m');
  await runStep('Landing page returns HTTP 200', async () => {
    const res = await request('/');
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200, got ${res.status}`);
    }
  });

  await runStep('Login page returns HTTP 200', async () => {
    const res = await request('/login');
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200, got ${res.status}`);
    }
  });

  await runStep('Privacy policy page returns HTTP 200', async () => {
    const res = await request('/privacy');
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200, got ${res.status}`);
    }
  });

  // 2. Auth Security Barriers
  console.log('\n\x1b[1m[Suite 2: Security Barriers & Protected Route Gates]\x1b[0m');
  await runStep('Anonymous GET /api/user/profile is rejected (401)', async () => {
    const res = await request('/api/user/profile');
    if (res.status !== 401) {
      throw new Error(`Expected HTTP 401, got ${res.status}`);
    }
  });

  await runStep('Anonymous GET /api/dashboard/stats is rejected (401)', async () => {
    const res = await request('/api/dashboard/stats');
    if (res.status !== 401) {
      throw new Error(`Expected HTTP 401, got ${res.status}`);
    }
  });

  await runStep('Anonymous PUT /api/user/profile is rejected (401)', async () => {
    const res = await request('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: 'Hacker' }),
    });
    if (res.status !== 401) {
      throw new Error(`Expected HTTP 401, got ${res.status}`);
    }
  });

  // 3. Cron Security
  console.log('\n\x1b[1m[Suite 3: Scheduled Jobs & Cron Authorization]\x1b[0m');
  await runStep('Unauthenticated /api/cron rejects access (401)', async () => {
    const res = await request('/api/cron');
    if (res.status !== 401) {
      throw new Error(`Expected HTTP 401, got ${res.status}`);
    }
  });

  await runStep('Unauthenticated /api/cron/sync-teams rejects access (401)', async () => {
    const res = await request('/api/cron/sync-teams');
    if (res.status !== 401) {
      throw new Error(`Expected HTTP 401, got ${res.status}`);
    }
  });

  if (CRON_SECRET) {
    await runStep('Authorized GET /api/cron/sync-teams succeeds with CRON_SECRET', async () => {
      const res = await request('/api/cron/sync-teams', {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });
      if (res.status !== 200) {
        const text = await res.text();
        throw new Error(`Expected HTTP 200, got ${res.status}: ${text}`);
      }
      const data = await res.json();
      if (!data.success && data.status !== 'success') {
        throw new Error(`Job response indicates failure: ${JSON.stringify(data)}`);
      }
    });
  } else {
    skipStep('Authorized cron job verification', 'CRON_SECRET environment variable not provided');
  }

  // 4. Real User Authentication
  console.log('\n\x1b[1m[Suite 4: Real Supabase Authentication]\x1b[0m');
  if (TEST_EMAIL && TEST_PASSWORD) {
    await runStep('Sign in via POST /api/auth/signin with real credentials', async () => {
      const res = await request('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
      });

      if (res.status !== 200) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Expected HTTP 200, got ${res.status} (${JSON.stringify(err)})`);
      }

      const body = await res.json();
      if (!body.session?.access_token || !body.user?.id) {
        throw new Error('Sign-in response missing session tokens or user id');
      }

      accessToken = body.session.access_token;
      refreshToken = body.session.refresh_token;

      // Verify cookies were received
      if (!cookieJar.has('sb-auth-token') && !cookieJar.has('sb-refresh-token')) {
        throw new Error('Sign-in did not set expected sb-auth-token / sb-refresh-token cookies');
      }
    });

    // 5. Authenticated Read
    console.log('\n\x1b[1m[Suite 5: Live Database Read]\x1b[0m');
    await runStep('Fetch profile via GET /api/user/profile with session', async () => {
      const res = await request('/api/user/profile', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });

      if (res.status !== 200) {
        throw new Error(`Expected HTTP 200, got ${res.status}`);
      }

      const body = await res.json();
      if (!body.profile?.id || !body.profile?.username) {
        throw new Error('Profile response did not contain expected profile record');
      }

      originalBio = body.profile.bio ?? null;
    });

    // 6. Authenticated Mutation & Safe Reversion
    console.log('\n\x1b[1m[Suite 6: Live Database Mutation & Rollback]\x1b[0m');
    const smokeBio = `[Smoke Test] Verified at ${new Date().toISOString()}`;

    await runStep('Mutate manager bio via PUT /api/user/profile', async () => {
      const res = await request('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ bio: smokeBio }),
      });

      if (res.status !== 200) {
        throw new Error(`Expected HTTP 200, got ${res.status}`);
      }

      // Verify the write persisted in Supabase
      const verifyRes = await request('/api/user/profile', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const verifyBody = await verifyRes.json();
      if (verifyBody.profile?.bio !== smokeBio) {
        throw new Error(`Bio mutation failed to persist: got "${verifyBody.profile?.bio}", expected "${smokeBio}"`);
      }
    });

    await runStep('Revert manager bio back to original state', async () => {
      const res = await request('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ bio: originalBio }),
      });

      if (res.status !== 200) {
        throw new Error(`Expected HTTP 200 on bio revert, got ${res.status}`);
      }
    });

    // 7. Token Rotation & Refresh Endpoint
    console.log('\n\x1b[1m[Suite 7: Token Refresh & Cookie Sync]\x1b[0m');
    await runStep('Refresh session cookies via POST /api/auth/refresh-session', async () => {
      if (!accessToken || !refreshToken) {
        throw new Error('No active tokens to refresh');
      }

      const res = await request('/api/auth/refresh-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
      });

      if (res.status !== 200) {
        throw new Error(`Expected HTTP 200, got ${res.status}`);
      }

      const body = await res.json();
      if (!body.ok) {
        throw new Error(`Refresh session response not ok: ${JSON.stringify(body)}`);
      }
    });

    // 8. Sign Out & Token Clearance
    console.log('\n\x1b[1m[Suite 8: Sign Out & Session Teardown]\x1b[0m');
    await runStep('Sign out via POST /api/auth/signout', async () => {
      const res = await request('/api/auth/signout', { method: 'POST' });
      if (res.status !== 200) {
        throw new Error(`Expected HTTP 200, got ${res.status}`);
      }

      // Ensure cookie jar cleared auth token
      if (cookieJar.has('sb-auth-token')) {
        throw new Error('sb-auth-token was not cleared from cookie jar upon signout');
      }
    });
  } else {
    skipStep('Real user sign-in', 'Set SMOKE_USER_EMAIL and SMOKE_USER_PASSWORD to enable');
    skipStep('Live database profile read', 'Requires authenticated test user');
    skipStep('Live database profile mutation', 'Requires authenticated test user');
    skipStep('Token refresh & cookie sync', 'Requires authenticated test user');
    skipStep('Sign out & session teardown', 'Requires authenticated test user');
  }

  // Final Summary
  console.log('\n======================================================');
  console.log(' 📊 SMOKE TEST EXECUTION SUMMARY');
  console.log('======================================================');
  console.log(`Passed  : \x1b[32m${testsPassed}\x1b[0m`);
  console.log(`Failed  : \x1b[31m${testsFailed}\x1b[0m`);
  console.log(`Skipped : \x1b[33m${testsSkipped}\x1b[0m`);
  console.log('======================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Fatal runner error:', err);
  process.exit(1);
});
