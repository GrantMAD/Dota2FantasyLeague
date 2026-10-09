import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAdminAuth, createErrorResponse } from '@/lib/auth-utils';
import { withApiTelemetry } from '@/lib/api-telemetry';


interface MatchRecord {
  [column: string]: unknown;
  team_a_id: number | null;
  team_b_id: number | null;
  series_id: number | null;
}

interface TeamRecord {
  id: number;
  name: string;
  logo_url: string | null;
}

interface SeriesRecord {
  id: number;
  tournament_id: number | null;
}

interface TournamentRecord {
  id: number;
  name: string;
  tier: string | null;
}

async function getHandler(request: NextRequest) {
  try {
    await verifyAdminAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const statusFilter = searchParams.get('status');

    const supabase = supabaseServer();

    let query = supabase.from('matches')
      .select('*', { count: 'exact' })
      .order('scheduled_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data: rawMatches, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch matches', details: error.message },
        { status: 500 }
      );
    }

    const matchRows = (rawMatches ?? []) as MatchRecord[];
    if (matchRows.length === 0) {
      return NextResponse.json({ data: [], total: 0, limit, offset });
    }

    const teamIds = [...new Set(matchRows.flatMap((match) => [match.team_a_id, match.team_b_id]).filter((id): id is number => id !== null))];
    const seriesIds = [...new Set(matchRows.map((match) => match.series_id).filter((id): id is number => id !== null))];

    const [{ data: teamData }, { data: seriesData }] = await Promise.all([
      supabase.from('professional_teams').select('id, name, logo_url').in('id', teamIds),
      supabase.from('tournament_series').select('id, tournament_id').in('id', seriesIds),
    ]);
    const teams = (teamData ?? []) as TeamRecord[];
    const seriesList = (seriesData ?? []) as SeriesRecord[];

    const tournamentIds = [...new Set(seriesList.map((series) => series.tournament_id).filter((id): id is number => id !== null))];
    const { data: tournamentData } = await supabase.from('tournaments')
      .select('id, name, tier')
      .in('id', tournamentIds);
    const tournaments = (tournamentData ?? []) as TournamentRecord[];

    const teamMap = new Map(teams.map((team) => [team.id, team] as const));
    const seriesMap = new Map(seriesList.map((series) => [series.id, series.tournament_id] as const));
    const tournamentMap = new Map(tournaments.map((tournament) => [tournament.id, tournament] as const));

    const enrichedMatches = matchRows.map((match) => {
      const tournamentId = match.series_id === null ? null : seriesMap.get(match.series_id);
      return {
        ...match,
        team_a: match.team_a_id === null ? null : teamMap.get(match.team_a_id) || null,
        team_b: match.team_b_id === null ? null : teamMap.get(match.team_b_id) || null,
        tournament: tournamentId ? tournamentMap.get(tournamentId) || null : null,
      };
    });

    return NextResponse.json({ data: enrichedMatches, total: count ?? enrichedMatches.length, limit, offset });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}

export const GET = withApiTelemetry('GET', '/api/admin/matches', getHandler);
