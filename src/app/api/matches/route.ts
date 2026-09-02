import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/response-cache';

/**
 * GET /api/matches
 * Returns matches, optionally filtered by gameweekId, tournamentId, teamId, or status.
 * Query params: gameweekId, tournamentId, teamId, status, limit (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cacheKey = `matches:${searchParams.toString()}`;
    const cached = getCached<{ matches: unknown[] }>(cacheKey);
    if (cached) return NextResponse.json(cached);
    const gameweekId = searchParams.get('gameweekId');
    const tournamentId = searchParams.get('tournamentId');
    const teamId = searchParams.get('teamId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);

    const supabase = supabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('matches') as any)
      .select(`
        id,
        status,
        scheduled_at,
        duration_seconds,
        gameweek_id,
        tournament_id,
        radiant_team_id,
        dire_team_id,
        winner_team_id,
        radiant_team:professional_teams!matches_radiant_team_id_fkey(id, name, tag),
        dire_team:professional_teams!matches_dire_team_id_fkey(id, name, tag),
        tournaments(id, name, slug)
      `)
      .order('scheduled_at', { ascending: false })
      .limit(limit);

    if (gameweekId) query = query.eq('gameweek_id', gameweekId);
    if (tournamentId) query = query.eq('tournament_id', tournamentId);
    if (status) query = query.eq('status', status);
    if (teamId) {
      // Filter matches where team played as radiant OR dire
      query = query.or(`radiant_team_id.eq.${teamId},dire_team_id.eq.${teamId}`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch matches.', details: error.message },
        { status: 500 }
      );
    }

    const response = { matches: data ?? [] };
    setCached(cacheKey, response, 60_000);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
