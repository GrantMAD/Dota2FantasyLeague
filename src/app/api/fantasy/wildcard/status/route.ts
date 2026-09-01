import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, AuthError } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await verifyAuth(request);

    // 2. Parse query params
    const searchParams = request.nextUrl.searchParams;
    const fantasySeasonId = searchParams.get('fantasy_season_id');

    if (!fantasySeasonId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: fantasy_season_id.' },
        { status: 400 }
      );
    }

    // 3. Fetch the wildcard status from fantasy_seasons
    const supabase = supabaseServer();
    const { data, error } = await (supabase
      .from('fantasy_seasons') as any)
      .select('id, wildcard_used_gameweek_id, free_transfers')
      .eq('id', parseInt(fantasySeasonId, 10))
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Supabase Error (wildcard status):', error);
      return NextResponse.json(
        { error: 'Database error fetching wildcard status.', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Fantasy season not found or access denied.' },
        { status: 404 }
      );
    }

    const wildcardUsed = data.wildcard_used_gameweek_id !== null;
    const wildcardActive = wildcardUsed && data.free_transfers === 99;

    return NextResponse.json({
      wildcardUsed,
      wildcardActive,
      wildcardUsedGameweekId: data.wildcard_used_gameweek_id ?? null,
      freeTransfers: data.free_transfers,
    });
  } catch (error: unknown) {
    console.error('Wildcard Status API Error:', error);

    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred fetching wildcard status.' },
      { status: 500 }
    );
  }
}
