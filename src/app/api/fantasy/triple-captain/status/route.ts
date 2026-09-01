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

    // 3. Fetch the triple captain status from fantasy_seasons
    const supabase = supabaseServer();
    const { data, error } = await (supabase
      .from('fantasy_seasons') as any)
      .select('id, triple_captain_gameweek_id')
      .eq('id', parseInt(fantasySeasonId, 10))
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Supabase Error (triple captain status):', error);
      return NextResponse.json(
        { error: 'Database error fetching triple captain status.', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Fantasy season not found or access denied.' },
        { status: 404 }
      );
    }

    const tripleCaptainUsed = data.triple_captain_gameweek_id !== null;

    return NextResponse.json({
      tripleCaptainUsed,
      tripleCaptainGameweekId: data.triple_captain_gameweek_id ?? null,
    });
  } catch (error: unknown) {
    console.error('Triple Captain Status API Error:', error);

    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred fetching triple captain status.' },
      { status: 500 }
    );
  }
}
