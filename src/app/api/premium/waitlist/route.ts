import { NextRequest, NextResponse } from 'next/server';
import { applyRefreshedTokens, verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';

function getErrorStatus(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = Number((error as { status?: unknown }).status);
    if (Number.isInteger(status) && status >= 400 && status <= 599) return status;
  }
  return 500;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to process the waitlist request.';
}

async function getHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const { data, error } = await supabaseServer()
      .from('premium_waitlist')
      .select('email')
      .eq('user_id', user.userId)
      .maybeSingle();

    if (error) {
      console.error('[Premium waitlist] Failed to load signup status:', error.message);
      return NextResponse.json({ error: 'Unable to load waitlist status.' }, { status: 500 });
    }

    const response = NextResponse.json({
      waitlisted: Boolean(data),
      email: data?.email ?? user.email,
    });
    applyRefreshedTokens(response, user);
    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorStatus(error) === 401 ? 'Sign in to manage the Premium waitlist.' : getErrorMessage(error) },
      { status: getErrorStatus(error) },
    );
  }
}

async function postHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'A valid JSON request body is required.' }, { status: 400 });
    }

    if (
      typeof body !== 'object' ||
      body === null ||
      !('email' in body) ||
      typeof body.email !== 'string'
    ) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (!('consent' in body) || body.consent !== true) {
      return NextResponse.json({ error: 'Consent is required to join the waitlist.' }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await supabaseServer()
      .from('premium_waitlist')
      .upsert(
        {
          user_id: user.userId,
          email,
          consented_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id' },
      );

    if (error) {
      console.error('[Premium waitlist] Failed to save signup:', error.message);
      return NextResponse.json({ error: 'Unable to join the Premium waitlist right now.' }, { status: 500 });
    }

    const response = NextResponse.json({ waitlisted: true });
    applyRefreshedTokens(response, user);
    return response;
  } catch (error: unknown) {
    const status = getErrorStatus(error);
    return NextResponse.json(
      { error: status === 401 ? 'Sign in to join the Premium waitlist.' : getErrorMessage(error) },
      { status },
    );
  }
}

async function deleteHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const { error } = await supabaseServer()
      .from('premium_waitlist')
      .delete()
      .eq('user_id', user.userId);

    if (error) {
      console.error('[Premium waitlist] Failed to remove signup:', error.message);
      return NextResponse.json({ error: 'Unable to remove your waitlist signup right now.' }, { status: 500 });
    }

    const response = NextResponse.json({ waitlisted: false });
    applyRefreshedTokens(response, user);
    return response;
  } catch (error: unknown) {
    const status = getErrorStatus(error);
    return NextResponse.json(
      { error: status === 401 ? 'Sign in to manage the Premium waitlist.' : getErrorMessage(error) },
      { status },
    );
  }
}

export const GET = withApiTelemetry('GET', '/api/premium/waitlist', getHandler);
export const POST = withApiTelemetry('POST', '/api/premium/waitlist', postHandler);
export const DELETE = withApiTelemetry('DELETE', '/api/premium/waitlist', deleteHandler);
