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
        .select('id, name, logo_url, region')
        .in('id', [matchRecord.team_a_id, matchRecord.team_b_id]),
      (supabase.from('tournament_series') as any)
        .select('id, tournament_id, best_of, series_number')
        .eq('id', matchRecord.series_id)
        .maybeSingle(),
    ]);

    const { data: tournament } = series
      ? await (supabase.from('tournaments') as any).select('id, name, slug, tier').eq('id', series.tournament_id).maybeSingle()
      : { data: null };
    const { data: gameweek } = await (supabase.from('gameweeks') as any)
      .select('id, gameweek_number, status')
      .eq('id', matchRecord.gameweek_id)
      .maybeSingle();

    const teamById = new Map<number, { id: number; name: string; logo_url: string | null; region?: string }>(
      (teams ?? []).map((team: any) => [team.id, team])
    );
    const buildTeam = (teamId: number) => {
      const team = teamById.get(teamId);
      return team ? { ...team, tag: team.name.slice(0, 4).toUpperCase() } : null;
    };
    const match = {
      ...matchRecord,
      best_of: series?.best_of || 3,
      series_number: series?.series_number || 1,
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
        hero_name,
        professional_players(id, name, in_game_name, primary_role, profile_image_url)
      `)
      .eq('match_id', matchId)
      .order('team_id', { ascending: true });

    // fantasy_points_breakdown has no match_id column — it joins via performance_id -> player_performances.
    // Fetch performances for this match, with nested breakdown, then flatten to player_id-keyed shape.
    const { data: performances } = await (supabase
      .from('player_performances') as any)
      .select('id, player_id, fantasy_points_breakdown(combat_points, economy_points, objective_points, teamfight_points, win_points, series_points, performance_index_points, consistency_points, penalty_points, total_points)')
      .eq('match_id', matchId);

    const fantasyBreakdown = (performances ?? [])
      .filter((p: any) => p.fantasy_points_breakdown) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((p: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        player_id: p.player_id,
        ...(p.fantasy_points_breakdown as object),
      }));

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
