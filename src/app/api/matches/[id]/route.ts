import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/matches/[id]
 * Returns a single match with full per-player stats and substitutions.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const matchId = parseInt(params.id, 10);
    if (isNaN(matchId)) {
      return NextResponse.json({ error: 'Invalid match ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Fetch match details
    const { data: match, error: matchError } = await (supabase
      .from('matches') as any)
      .select(`
        *,
        radiant_team:professional_teams!matches_radiant_team_id_fkey(id, name, tag),
        dire_team:professional_teams!matches_dire_team_id_fkey(id, name, tag),
        tournaments(id, name, slug),
        gameweeks(id, gameweek_number, status)
      `)
      .eq('id', matchId)
      .maybeSingle();

    if (matchError) {
      return NextResponse.json(
        { error: 'Failed to fetch match.', details: matchError.message },
        { status: 500 }
      );
    }

    if (!match) {
      return NextResponse.json({ error: 'Match not found.' }, { status: 404 });
    }

    // Fetch per-player stats for this match
    const { data: playerStats } = await (supabase
      .from('match_player_stats') as any)
      .select(`
        *,
        professional_players(id, name, in_game_name, primary_role, profile_image_url)
      `)
      .eq('match_id', matchId)
      .order('team_id', { ascending: true });

    // Fetch fantasy points breakdown per player for this match
    const { data: fantasyBreakdown } = await (supabase
      .from('fantasy_points_breakdown') as any)
      .select('player_id, total_points, combat_points, economy_points, objective_points, win_points')
      .eq('match_id', matchId);

    // Fetch substitutions
    const { data: substitutions } = await (supabase
      .from('match_player_substitutions') as any)
      .select(`
        id,
        rostered_player_id,
        stand_in_player_id,
        rostered_player:professional_players!match_player_substitutions_rostered_player_id_fkey(id, name),
        stand_in_player:professional_players!match_player_substitutions_stand_in_player_id_fkey(id, name)
      `)
      .eq('match_id', matchId);

    return NextResponse.json({
      match,
      playerStats: playerStats ?? [],
      fantasyBreakdown: fantasyBreakdown ?? [],
      substitutions: substitutions ?? [],
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
