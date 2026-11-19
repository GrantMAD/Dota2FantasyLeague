import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAdminAuth, createErrorResponse } from '@/lib/auth-utils';
import { withApiTelemetry } from '@/lib/api-telemetry';

interface SeriesRow {
  id: number;
  tournament_id: number;
  gameweek_id: number;
  series_number: number;
  best_of: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  source_series_id: string | null;
  created_at: string;
}

interface TeamRecord {
  id: number;
  name: string;
  logo_url: string | null;
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');
    const gameweekId = searchParams.get('gameweek_id');
    const tournamentId = searchParams.get('tournament_id');

    const supabase = supabaseServer();

    let query = supabase
      .from('tournament_series')
      .select('*', { count: 'exact' });

    if (gameweekId) {
      const parsedGw = parseInt(gameweekId);
      if (!isNaN(parsedGw)) {
        query = query.eq('gameweek_id', parsedGw);
      }
    }

    if (tournamentId) {
      const parsedTourney = parseInt(tournamentId);
      if (!isNaN(parsedTourney)) {
        query = query.eq('tournament_id', parsedTourney);
      }
    }

    const { data: rawSeries, count, error } = await query
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch tournament series', details: error.message },
        { status: 500 }
      );
    }

    const seriesRows = (rawSeries ?? []) as SeriesRow[];
    if (seriesRows.length === 0) {
      return NextResponse.json({ data: [], total: 0, limit, offset });
    }

    const teamIds = [
      ...new Set(
        seriesRows
          .flatMap((s) => [s.team_a_id, s.team_b_id])
          .filter((id): id is number => id !== null)
      ),
    ];
    const tournamentIds = [
      ...new Set(
        seriesRows
          .map((s) => s.tournament_id)
          .filter((id): id is number => id !== null)
      ),
    ];
    const seriesIds = seriesRows.map((s) => s.id);

    const [{ data: teamData }, { data: tournamentData }, { data: matchCounts }] = await Promise.all([
      teamIds.length > 0
        ? supabase.from('professional_teams').select('id, name, logo_url').in('id', teamIds)
        : Promise.resolve({ data: [] }),
      tournamentIds.length > 0
        ? supabase.from('tournaments').select('id, name, tier').in('id', tournamentIds)
        : Promise.resolve({ data: [] }),
      seriesIds.length > 0
        ? supabase.from('matches').select('series_id').in('series_id', seriesIds)
        : Promise.resolve({ data: [] }),
    ]);

    const teams = (teamData ?? []) as TeamRecord[];
    const tournaments = (tournamentData ?? []) as TournamentRecord[];
    const matches = (matchCounts ?? []) as Array<{ series_id: number }>;

    const matchCountBySeries = new Map<number, number>();
    for (const m of matches) {
      matchCountBySeries.set(m.series_id, (matchCountBySeries.get(m.series_id) ?? 0) + 1);
    }

    const teamMap = new Map(teams.map((t) => [t.id, t] as const));
    const tournamentMap = new Map(tournaments.map((t) => [t.id, t] as const));

    const enrichedSeries = seriesRows.map((series) => ({
      ...series,
      team_a: series.team_a_id !== null ? teamMap.get(series.team_a_id) || null : null,
      team_b: series.team_b_id !== null ? teamMap.get(series.team_b_id) || null : null,
      tournament: series.tournament_id ? tournamentMap.get(series.tournament_id) || null : null,
      match_count: matchCountBySeries.get(series.id) ?? 0,
    }));

    return NextResponse.json({
      data: enrichedSeries,
      total: count ?? enrichedSeries.length,
      limit,
      offset,
    });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}

export const GET = withApiTelemetry('GET', '/api/admin/series', getHandler);
