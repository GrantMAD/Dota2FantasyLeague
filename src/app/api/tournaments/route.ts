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
  team_a_id: number | null;
  team_b_id: number | null;
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

    if (tournamentIds.length > 0) {
      const { data: allSeriesData } = await supabase.from('tournament_series')
        .select('id, tournament_id, team_a_id, team_b_id')
        .in('tournament_id', tournamentIds);

      const seriesList = (allSeriesData ?? []) as SeriesTeamRecord[];
      seriesList.forEach((series) => {
        const list = seriesByTournament.get(series.tournament_id) || [];
        list.push(series);
        seriesByTournament.set(series.tournament_id, list);
      });

      const allTeamIds = [...new Set(seriesList.flatMap((series) => [series.team_a_id, series.team_b_id]).filter((id): id is number => id !== null))];
      if (allTeamIds.length > 0) {
        const { data: teamsData } = await supabase.from('professional_teams')
          .select('id, name, logo_url')
          .in('id', allTeamIds);
        ((teamsData ?? []) as TeamSummary[]).forEach((team) => teamsMap.set(team.id, team));
      }
    }

    const enrichedTournaments = tournaments.map((tournament) => {
      const seriesList = seriesByTournament.get(tournament.id) || [];
      const teamIds = [...new Set(seriesList.flatMap((series) => [series.team_a_id, series.team_b_id]).filter((id): id is number => id !== null))];
      const participatingTeams = teamIds.map((id) => teamsMap.get(id)).filter((team): team is TeamSummary => team !== undefined);

      return {
        ...tournament,
        series_count: seriesList.length,
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
