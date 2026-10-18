import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function getHandler(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const supabase = supabaseServer();
    const { data, error } = await supabase.rpc('mobile_get_transfer_suggestions', {
      p_viewer_id: userId,
    });

    if (error) {
      console.error('[Transfer suggestions] Failed to load recommendations:', error.message);
      return NextResponse.json({ error: 'Failed to load transfer suggestions.' }, { status: 500 });
    }
    if (
      !isRecord(data) ||
      !Array.isArray(data.recommendations) ||
      !Number.isInteger(data.completed_gameweeks) ||
      !Number.isInteger(data.required_gameweeks) ||
      !Number.isInteger(data.priced_role_matched_candidates)
    ) {
      console.error('[Transfer suggestions] Recommendation RPC returned an invalid response.');
      return NextResponse.json({ error: 'Transfer suggestions were returned in an unexpected format.' }, { status: 502 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: number }).status)
      : 500;
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to load transfer suggestions.',
    }, { status });
  }
}

export const GET = withApiTelemetry('GET', '/api/fantasy/transfer-suggestions', getHandler);
