import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

type AuthRateLimitAction = 'signin' | 'signup';

type AuthRateLimitResult = {
  allowed: boolean;
  retry_after_seconds: number;
};

function getClientAddress(request: NextRequest): string {
  const vercelForwardedFor = request.headers.get('x-vercel-forwarded-for');
  if (vercelForwardedFor?.trim()) return vercelForwardedFor.split(',')[0].trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp?.trim()) return realIp.trim();

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor?.trim()) {
    const addresses = forwardedFor.split(',');
    return addresses[addresses.length - 1].trim();
  }

  return 'unknown';
}

export async function enforceAuthRateLimit(
  request: NextRequest,
  action: AuthRateLimitAction,
): Promise<NextResponse | null> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    console.error('Auth rate limiting is unavailable because the service-role key is not configured.');
    return NextResponse.json(
      { error: 'Authentication is temporarily unavailable. Please try again later.' },
      { status: 503 },
    );
  }

  const identifierHash = createHmac('sha256', secret)
    .update(getClientAddress(request))
    .digest('hex');

  try {
    const { data, error } = await supabaseServer().rpc('consume_auth_rate_limit', {
      p_action: action,
      p_identifier_hash: identifierHash,
    });

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] as AuthRateLimitResult | undefined : undefined;
    if (!result || typeof result.allowed !== 'boolean') {
      throw new Error('Rate-limit RPC returned an invalid response.');
    }

    if (result.allowed) return null;

    const retryAfterSeconds = Number.isInteger(result.retry_after_seconds)
      ? Math.max(1, result.retry_after_seconds)
      : 60;
    return NextResponse.json(
      { error: 'Too many authentication attempts. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) },
      },
    );
  } catch (error: unknown) {
    const errorMessage = typeof error === 'object'
      && error !== null
      && 'message' in error
      && typeof error.message === 'string'
      ? error.message
      : String(error);
    console.error('Auth rate limiting failed; authentication request was rejected.', {
      action,
      error: errorMessage,
    });
    return NextResponse.json(
      { error: 'Authentication is temporarily unavailable. Please try again later.' },
      { status: 503 },
    );
  }
}
