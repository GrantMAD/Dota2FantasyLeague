import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface MatchRecord {
  [column: string]: unknown;
  id: number;
  status: string;
  scheduled_time: string;
  duration_minutes: number | null;
  gameweek_id: number | null;
  series_id: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  winner_team_id: number | null;
}

interface TeamRecord {
  id: number;
  name: string;
  logo_url: string | null;
  region: string | null;
}

interface SeriesRecord {
  id: number;
  tournament_id: number | null;
  best_of: number | null;
  series_number: number | null;
}

interface TournamentRecord {
  id: number;
  name: string;
  slug: string;
  tier: string | null;
}

interface GameweekRecord {
  id: number;
  gameweek_number: number;
  status: string;
}

interface FantasyPointsRecord {
  combat_points: number | null;
  economy_points: number | null;
  objective_points: number | null;
  teamfight_points: number | null;
  win_points: number | null;
  series_points: number | null;
  performance_index_points: number | null;
  consistency_points: number | null;
  penalty_points: number | null;
  total_points: number | null;
}

interface PerformanceRecord {
  player_id: number;
  fantasy_points_breakdown: FantasyPointsRecord | FantasyPointsRecord[] | null;
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
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('id, status, scheduled_time, duration_minutes, gameweek_id, series_id, team_a_id, team_b_id, winner_team_id')
      .eq('id', matchId)
      .maybeSingle();
    const matchRecord = matchData as MatchRecord | null;

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
      supabase.from('professional_teams')
        .select('id, name, logo_url, region')
        .in('id', [matchRecord.team_a_id, matchRecord.team_b_id].filter((id): id is number => id !== null)),
      supabase.from('tournament_series')
        .select('id, tournament_id, best_of, series_number')
        .eq('id', matchRecord.series_id)
        .maybeSingle(),
    ]);
      const teamRows = (teams ?? []) as TeamRecord[];
      const seriesRecord = series as SeriesRecord | null;

      const { data: tournamentData } = seriesRecord?.tournament_id
        ? await supabase.from('tournaments').select('id, name, slug, tier').eq('id', seriesRecord.tournament_id).maybeSingle()
      : { data: null };
      const tournament = tournamentData as TournamentRecord | null;
      const { data: gameweekData } = await supabase.from('gameweeks')
      .select('id, gameweek_number, status')
      .eq('id', matchRecord.gameweek_id)
      .maybeSingle();
      const gameweek = gameweekData as GameweekRecord | null;

      const teamById = new Map(teamRows.map((team) => [team.id, team] as const));
      const buildTeam = (teamId: number | null) => {
        if (teamId === null) return null;
      const team = teamById.get(teamId);
      return team ? { ...team, tag: team.name.slice(0, 4).toUpperCase() } : null;
    };
    const match = {
      ...matchRecord,
      best_of: seriesRecord?.best_of || 3,
      series_number: seriesRecord?.series_number || 1,
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
    // The generated local schema does not include this table.
    const { data: playerStats } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const { data: performanceData } = await supabase
      .from('player_performances')
      .select('id, player_id, fantasy_points_breakdown(combat_points, economy_points, objective_points, teamfight_points, win_points, series_points, performance_index_points, consistency_points, penalty_points, total_points)')
      .eq('match_id', matchId);

    const performances = (performanceData ?? []) as PerformanceRecord[];
    const fantasyBreakdown = performances.flatMap((performance) => {
      const breakdown = Array.isArray(performance.fantasy_points_breakdown)
        ? performance.fantasy_points_breakdown[0]
        : performance.fantasy_points_breakdown;
      return breakdown ? [{ player_id: performance.player_id, ...breakdown }] : [];
    });

    // Fetch substitutions
    const { data: substitutions } = await supabase
      .from('match_player_substitutions')
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
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
