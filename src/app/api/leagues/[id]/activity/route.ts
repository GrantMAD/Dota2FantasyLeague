import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getHandler(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await verifyAuth(request);
    const { id } = await context.params;
    const leagueId = Number(id);
    if (!Number.isSafeInteger(leagueId) || leagueId <= 0) {
      return NextResponse.json({ error: 'Invalid league ID.' }, { status: 400 });
    }

    const { data, error } = await supabaseServer().rpc('mobile_get_league_activity', {
      p_league_id: leagueId,
      p_limit: 50,
      p_viewer_id: userId,
    });
    if (error) {
      const status = error.code === '42501' ? 403 : 500;
      return NextResponse.json({ error: 'Unable to load league activity.' }, { status });
    }
    if (
      typeof data !== 'object' ||
      data === null ||
      !('activities' in data) ||
      !Array.isArray(data.activities)
    ) {
      return NextResponse.json({ error: 'League activity response was invalid.' }, { status: 502 });
    }
    return NextResponse.json(data);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      'message' in error &&
      typeof error.status === 'number' &&
      typeof error.message === 'string'
    ) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('GET /api/leagues/[id]/activity failed:', error);
    return NextResponse.json({ error: 'Unable to load league activity.' }, { status: 500 });
  }
}

export const GET = withApiTelemetry('GET', '/api/leagues/[id]/activity', getHandler);
