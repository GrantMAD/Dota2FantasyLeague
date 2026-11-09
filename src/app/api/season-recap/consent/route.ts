import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';

type ConsentRow = {
  season_recap_sharing_consent: boolean;
};

function getErrorStatus(error: unknown, fallback: number): number {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status: number }).status)
    : fallback;
}

async function getHandler(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const { data, error } = await supabaseServer().from('users')
      .select('season_recap_sharing_consent')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error(`Unable to load recap sharing preference: ${error.message}`);
    if (!data) return NextResponse.json({ error: 'User profile was not found.' }, { status: 404 });

    return NextResponse.json({
      sharingConsent: (data as ConsentRow).season_recap_sharing_consent,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: unknown) {
    const status = getErrorStatus(error, 500);
    const message = error instanceof Error ? error.message : 'Unable to load recap sharing preference.';
    return NextResponse.json({ error: message }, { status });
  }
}

async function putHandler(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }
    if (typeof body !== 'object' || body === null || !('sharingConsent' in body)
      || typeof body.sharingConsent !== 'boolean') {
      return NextResponse.json({ error: 'sharingConsent must be true or false.' }, { status: 400 });
    }

    const { data, error } = await supabaseServer().from('users')
      .update({
        season_recap_sharing_consent: body.sharingConsent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('season_recap_sharing_consent')
      .maybeSingle();
    if (error) throw new Error(`Unable to save recap sharing preference: ${error.message}`);
    if (!data) return NextResponse.json({ error: 'User profile was not found.' }, { status: 404 });

    return NextResponse.json({
      sharingConsent: (data as ConsentRow).season_recap_sharing_consent,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: unknown) {
    const status = getErrorStatus(error, 500);
    const message = error instanceof Error ? error.message : 'Unable to save recap sharing preference.';
    return NextResponse.json({ error: message }, { status });
  }
}

export const GET = withApiTelemetry('GET', '/api/season-recap/consent', getHandler);
export const PUT = withApiTelemetry('PUT', '/api/season-recap/consent', putHandler);
