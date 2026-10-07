import { NextRequest, NextResponse } from 'next/server';
import { AuthError, verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';

/**
 * GET /api/squads - Fetch the authenticated user's fantasy squads.
 * Query params:
 *   - season_id: Optional season filter.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const seasonIdParam = request.nextUrl.searchParams.get('season_id');
    const seasonId = seasonIdParam === null ? null : Number(seasonIdParam);

    if (seasonIdParam !== null && (seasonId === null || !Number.isInteger(seasonId) || seasonId <= 0)) {
      return NextResponse.json({ error: 'season_id must be a positive integer.' }, { status: 400 });
    }

    let query = supabaseServer()
      .from('fantasy_squads')
      .select(`
        id,
        name,
        fantasy_season_id,
        created_at,
        updated_at,
        fantasy_seasons!inner(id, user_id, season_id),
        fantasy_squad_members(id, player_id, cost)
      `)
      .eq('fantasy_seasons.user_id', userId);

    if (seasonId !== null) {
      query = query.eq('fantasy_seasons.season_id', seasonId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to fetch authenticated fantasy squads:', error);
      return NextResponse.json({ error: 'Failed to fetch squads.' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    console.error('Unexpected error fetching fantasy squads:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * POST /api/squads - Create a fantasy squad for a season owned by the caller.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object.' }, { status: 400 });
    }

    const payload = body as { fantasy_season_id?: unknown; name?: unknown };
    const fantasySeasonId = payload.fantasy_season_id;
    if (typeof fantasySeasonId !== 'number' || !Number.isInteger(fantasySeasonId) || fantasySeasonId <= 0) {
      return NextResponse.json({ error: 'fantasy_season_id must be a positive integer.' }, { status: 400 });
    }

    if (
      payload.name !== undefined
      && (typeof payload.name !== 'string' || payload.name.trim().length === 0 || payload.name.trim().length > 255)
    ) {
      return NextResponse.json({ error: 'name must be a non-empty string of at most 255 characters.' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data: fantasySeason, error: fantasySeasonError } = await supabase
      .from('fantasy_seasons')
      .select('id')
      .eq('id', fantasySeasonId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fantasySeasonError) {
      console.error('Failed to verify fantasy season ownership:', fantasySeasonError);
      return NextResponse.json({ error: 'Unable to verify fantasy season ownership.' }, { status: 500 });
    }
    if (!fantasySeason) {
      return NextResponse.json({ error: 'Fantasy season not found.' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('fantasy_squads')
      .insert({
        fantasy_season_id: fantasySeasonId,
        name: typeof payload.name === 'string' ? payload.name.trim() : 'My Squad',
      })
      .select();

    if (error) {
      console.error('Failed to create fantasy squad:', error);
      return NextResponse.json({ error: 'Failed to create squad.' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    console.error('Unexpected error creating fantasy squad:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
