import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/response-cache';
import { withApiTelemetry } from '@/lib/api-telemetry';


interface TournamentRecord {
  [column: string]: unknown;
  id: number;
  season_id: number;
  name: string;
  slug: string;
  status: string;
  tier: string | null;
  start_date: string;
  end_date: string;
  eligible: boolean;
  last_synced_at: string | null;
}

interface SeriesTeamRecord {
  id: number;
  tournament_id: number;
  series_number: number;
  best_of: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
}

interface MatchSummaryRecord {
  series_id: number;
  status: string;
  scheduled_time: string;
}

interface TeamSummary {
  id: number;
  name: string;
  logo_url: string | null;
}

/**
 * GET /api/tournaments
 * Returns tournaments, optionally filtered by seasonId and/or status.
 * Query params: seasonId, status (eligible|excluded|provisional|archived)
 */
async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const status = searchParams.get('status');
    const cacheKey = `tournaments:${searchParams.toString()}`;
    const cached = getCached<{ tournaments: unknown[] }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const supabase = supabaseServer();
    let query = supabase.from('tournaments')
      .select(`
        id,
        season_id,
        name,
        slug,
        status,
        tier,
        start_date,
        end_date,
        eligible,
        last_synced_at
      `)
      .order('start_date', { ascending: false });

    if (seasonId) query = query.eq('season_id', seasonId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch tournaments.', details: error.message },
        { status: 500 }
      );
    }

    const tournaments = (data ?? []) as TournamentRecord[];
    const tournamentIds = tournaments.map((tournament) => tournament.id);
    const seriesByTournament = new Map<number, SeriesTeamRecord[]>();
    const teamsMap = new Map<number, TeamSummary>();
    const matchesBySeries = new Map<number, MatchSummaryRecord[]>();

    if (tournamentIds.length > 0) {
      const { data: allSeriesData, error: seriesError } = await supabase.from('tournament_series')
        .select('id, tournament_id, series_number, best_of, team_a_id, team_b_id')
        .in('tournament_id', tournamentIds);
      if (seriesError) {
        return NextResponse.json(
          { error: 'Failed to fetch tournament series.', details: seriesError.message },
          { status: 500 },
        );
      }

      const seriesList = (allSeriesData ?? []) as SeriesTeamRecord[];
      seriesList.forEach((series) => {
        const list = seriesByTournament.get(series.tournament_id) || [];
        list.push(series);
        seriesByTournament.set(series.tournament_id, list);
      });

      const seriesIds = seriesList.map((series) => series.id);
      if (seriesIds.length > 0) {
        const { data: matchData, error: matchesError } = await supabase.from('matches')
          .select('series_id, status, scheduled_time')
          .in('series_id', seriesIds);
        if (matchesError) {
          return NextResponse.json(
            { error: 'Failed to fetch tournament match progress.', details: matchesError.message },
            { status: 500 },
          );
        }
        for (const match of (matchData ?? []) as MatchSummaryRecord[]) {
          const matches = matchesBySeries.get(match.series_id) ?? [];
          matches.push(match);
          matchesBySeries.set(match.series_id, matches);
        }
      }

      const allTeamIds = [...new Set(seriesList.flatMap((series) => [series.team_a_id, series.team_b_id]).filter((id): id is number => id !== null))];
      if (allTeamIds.length > 0) {
        const { data: teamsData, error: teamsError } = await supabase.from('professional_teams')
          .select('id, name, logo_url')
          .in('id', allTeamIds);
        if (teamsError) {
          return NextResponse.json(
            { error: 'Failed to fetch tournament teams.', details: teamsError.message },
            { status: 500 },
          );
        }
        ((teamsData ?? []) as TeamSummary[]).forEach((team) => teamsMap.set(team.id, team));
      }
    }

    const enrichedTournaments = tournaments.map((tournament) => {
      const seriesList = seriesByTournament.get(tournament.id) || [];
      const teamIds = [...new Set(seriesList.flatMap((series) => [series.team_a_id, series.team_b_id]).filter((id): id is number => id !== null))];
      const participatingTeams = teamIds.map((id) => teamsMap.get(id)).filter((team): team is TeamSummary => team !== undefined);
      const tournamentMatches = seriesList.flatMap((series) => matchesBySeries.get(series.id) ?? []);
      const completedMatches = tournamentMatches.filter((match) => match.status === 'completed').length;
      const liveMatches = tournamentMatches.filter((match) => match.status === 'in_progress').length;
      const upcomingMatches = tournamentMatches
        .filter((match) => match.status === 'scheduled' && new Date(match.scheduled_time).getTime() >= Date.now())
        .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
      const upcomingMatch = upcomingMatches[0];
      const upcomingSeries = upcomingMatch
        ? seriesList.find((series) => series.id === upcomingMatch.series_id)
        : undefined;

      return {
        ...tournament,
        series_count: seriesList.length,
        match_count: tournamentMatches.length,
        completed_match_count: completedMatches,
        live_match_count: liveMatches,
        best_of_formats: [...new Set(seriesList.map((series) => series.best_of).filter((bestOf): bestOf is number => bestOf !== null))].sort(),
        upcoming_series: upcomingSeries && upcomingMatch ? {
          series_number: upcomingSeries.series_number,
          scheduled_time: upcomingMatch.scheduled_time,
          team_a: upcomingSeries.team_a_id === null ? null : teamsMap.get(upcomingSeries.team_a_id)?.name ?? null,
          team_b: upcomingSeries.team_b_id === null ? null : teamsMap.get(upcomingSeries.team_b_id)?.name ?? null,
        } : null,
        participating_teams: participatingTeams,
      };
    });

    const response = { tournaments: enrichedTournaments };
    setCached(cacheKey, response, 60_000);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export const GET = withApiTelemetry('GET', '/api/tournaments', getHandler);
