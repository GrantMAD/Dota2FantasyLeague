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

    // Fetch match details using the current schema.
    const { data: matchRecord, error: matchError } = await (supabase
      .from('matches') as any)
      .select('id, status, scheduled_time, duration_minutes, gameweek_id, series_id, team_a_id, team_b_id, winner_team_id')
      .eq('id', matchId)
      .maybeSingle();

    if (matchError) {
      return NextResponse.json(
        { error: 'Failed to fetch match.', details: matchError.message },
        { status: 500 }
      );
    }

    if (!matchRecord) {
      return NextResponse.json({ error: 'Match not found.' }, { status: 404 });
    }

    const [{ data: teams }, { data: series }] = await Promise.all([
      (supabase.from('professional_teams') as any)
        .select('id, name, logo_url')
        .in('id', [matchRecord.team_a_id, matchRecord.team_b_id]),
      (supabase.from('tournament_series') as any)
        .select('id, tournament_id')
        .eq('id', matchRecord.series_id)
        .maybeSingle(),
    ]);

    const { data: tournament } = series
      ? await (supabase.from('tournaments') as any).select('id, name, slug').eq('id', series.tournament_id).maybeSingle()
      : { data: null };
    const { data: gameweek } = await (supabase.from('gameweeks') as any)
      .select('id, gameweek_number, status')
      .eq('id', matchRecord.gameweek_id)
      .maybeSingle();

    const teamById = new Map<number, { id: number; name: string; logo_url: string | null }>(
      (teams ?? []).map((team: { id: number; name: string; logo_url: string | null }) => [team.id, team])
    );
    const buildTeam = (teamId: number) => {
      const team = teamById.get(teamId);
      return team ? { ...team, tag: team.name.slice(0, 4).toUpperCase() } : null;
    };
    const match = {
      ...matchRecord,
      scheduled_at: matchRecord.scheduled_time,
      duration_seconds: matchRecord.duration_minutes ? matchRecord.duration_minutes * 60 : null,
      radiant_team_id: matchRecord.team_a_id,
      dire_team_id: matchRecord.team_b_id,
      radiant_team: buildTeam(matchRecord.team_a_id),
      dire_team: buildTeam(matchRecord.team_b_id),
      tournaments: tournament,
      gameweeks: gameweek,
    };

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
