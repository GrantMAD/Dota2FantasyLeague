import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';


interface RouteContext {
  params: Promise<{ id: string }>;
}

interface TournamentRecord {
  [column: string]: unknown;
  id: number;
  name: string;
  tier: string | null;
}

interface SeriesRecord {
  id: number;
  series_number: number | null;
  best_of: number | null;
  gameweek_id: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
}

interface MatchRecord {
  [column: string]: unknown;
  id: number;
  series_id: number;
  gameweek_id: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  match_number: number | null;
  status: string;
  scheduled_time: string;
  duration_minutes: number | null;
  winner_team_id: number | null;
}

interface TeamRecord {
  id: number;
  name: string;
  slug: string;
  region: string | null;
  logo_url: string | null;
}

/**
 * GET /api/tournaments/[id]
 * Returns a single tournament with its series, matches, and competing teams.
 */
async function getHandler(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const tournamentId = parseInt(params.id, 10);
    if (isNaN(tournamentId)) {
      return NextResponse.json({ error: 'Invalid tournament ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // 1. Fetch tournament
    const { data: tournamentData, error: tError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .maybeSingle();
    const tournament = tournamentData as TournamentRecord | null;

    if (tError) {
      return NextResponse.json(
        { error: 'Failed to fetch tournament.', details: tError.message },
        { status: 500 }
      );
    }

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found.' }, { status: 404 });
    }

    // 2. Fetch series belonging to this tournament
    const { data: seriesData, error: sError } = await supabase
      .from('tournament_series')
      .select('id, series_number, best_of, gameweek_id, team_a_id, team_b_id')
      .eq('tournament_id', tournamentId)
      .order('series_number', { ascending: true });
    const seriesList = (seriesData ?? []) as SeriesRecord[];

    if (sError) {
      return NextResponse.json(
        { error: 'Failed to fetch series.', details: sError.message },
        { status: 500 }
      );
    }

    const seriesIds = seriesList.map((series) => series.id);
    const seriesMap = new Map(seriesList.map((series) => [series.id, series] as const));

    // 3. Fetch matches belonging to those series
    let matches: MatchRecord[] = [];
    if (seriesIds.length > 0) {
      const { data: matchData, error: mError } = await supabase
        .from('matches')
        .select(`
          id,
          series_id,
          gameweek_id,
          team_a_id,
          team_b_id,
          match_number,
          status,
          scheduled_time,
          duration_minutes,
          winner_team_id
        `)
        .in('series_id', seriesIds)
        .order('scheduled_time', { ascending: true });

      if (mError) {
        return NextResponse.json(
          { error: 'Failed to fetch tournament matches.', details: mError.message },
          { status: 500 }
        );
      }
      matches = (matchData ?? []) as MatchRecord[];
    }

    // 4. Resolve teams and logos
    const teamIds = [
      ...new Set([
        ...seriesList.flatMap((series) => [series.team_a_id, series.team_b_id]),
        ...matches.flatMap((match) => [match.team_a_id, match.team_b_id]),
      ]),
    ].filter((id): id is number => id !== null);

    let teams: TeamRecord[] = [];
    if (teamIds.length > 0) {
      const { data: teamData } = await supabase
        .from('professional_teams')
        .select('id, name, slug, region, logo_url')
        .in('id', teamIds);
      teams = (teamData ?? []) as TeamRecord[];
    }

    const teamById = new Map(teams.map((team) => [team.id, team] as const));

    // 5. Enrich matches with team objects, best_of, and duration_seconds
    const enrichedMatches = matches.map((match) => {
      const sInfo = seriesMap.get(match.series_id);
      const teamA = match.team_a_id === null ? undefined : teamById.get(match.team_a_id);
      const teamB = match.team_b_id === null ? undefined : teamById.get(match.team_b_id);

      return {
        ...match,
        match_number: match.match_number || 1,
        best_of: sInfo?.best_of || 3,
        series_number: sInfo?.series_number || 1,
        scheduled_at: match.scheduled_time,
        duration_seconds: match.duration_minutes ? match.duration_minutes * 60 : null,
        radiant_team_id: match.team_a_id,
        dire_team_id: match.team_b_id,
        radiant_team: teamA ? { ...teamA, tag: teamA.name.slice(0, 4).toUpperCase() } : null,
        dire_team: teamB ? { ...teamB, tag: teamB.name.slice(0, 4).toUpperCase() } : null,
        tournaments: { id: tournament.id, name: tournament.name, tier: tournament.tier },
      };
    });

    return NextResponse.json({
      tournament,
      teams,
      series: seriesList ?? [],
      matches: enrichedMatches,
    });
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export const GET = withApiTelemetry('GET', '/api/tournaments/:id', getHandler);
