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
    let tournamentSeriesIds: number[] | null = null;

    if (tournamentId) {
      const { data: series, error: seriesError } = await (supabase.from('tournament_series') as any)
        .select('id')
        .eq('tournament_id', tournamentId);

      if (seriesError) {
        return NextResponse.json(
          { error: 'Failed to fetch tournament series.', details: seriesError.message },
          { status: 500 }
        );
      }

      const resolvedSeriesIds = (series ?? []).map((item: { id: number }) => item.id);
      tournamentSeriesIds = resolvedSeriesIds;
      if (resolvedSeriesIds.length === 0) {
        return NextResponse.json({ matches: [] });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('matches') as any)
      .select(`
        id,
        status,
        scheduled_time,
        duration_minutes,
        gameweek_id,
        series_id,
        team_a_id,
        team_b_id,
        winner_team_id
      `)
      .order('scheduled_time', { ascending: false })
      .limit(limit);

    if (gameweekId) query = query.eq('gameweek_id', gameweekId);
    const seriesFilterIds = tournamentSeriesIds;
    if (seriesFilterIds !== null) query = query.in('series_id', seriesFilterIds);
    if (status) query = query.eq('status', status);
    if (teamId) {
      // Filter matches where team played as radiant OR dire
      query = query.or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch matches.', details: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      const response = { matches: [] };
      setCached(cacheKey, response, 60_000);
      return NextResponse.json(response);
    }

    const teamIds = [...new Set((data ?? []).flatMap((match: any) => [match.team_a_id, match.team_b_id]))];
    const seriesIds = [...new Set((data ?? []).map((match: any) => match.series_id))];

    const [{ data: teams, error: teamsError }, { data: series, error: seriesError }] = await Promise.all([
      (supabase.from('professional_teams') as any).select('id, name, logo_url').in('id', teamIds),
      (supabase.from('tournament_series') as any).select('id, tournament_id').in('id', seriesIds),
    ]);

    if (teamsError || seriesError) {
      return NextResponse.json(
        { error: 'Failed to fetch match relationships.', details: teamsError?.message ?? seriesError?.message },
        { status: 500 }
      );
    }

    const tournamentIds = [...new Set((series ?? []).map((item: { tournament_id: number }) => item.tournament_id))];
    const { data: tournaments, error: tournamentsError } = await (supabase.from('tournaments') as any)
      .select('id, name, slug')
      .in('id', tournamentIds);

    if (tournamentsError) {
      return NextResponse.json(
        { error: 'Failed to fetch match tournaments.', details: tournamentsError.message },
        { status: 500 }
      );
    }

    const teamById = new Map<number, { id: number; name: string; logo_url: string | null }>(
      (teams ?? []).map((team: { id: number; name: string; logo_url: string | null }) => [team.id, team])
    );
    const tournamentById = new Map((tournaments ?? []).map((tournament: any) => [tournament.id, tournament]));
    const tournamentBySeriesId = new Map((series ?? []).map((item: any) => [item.id, tournamentById.get(item.tournament_id)]));

    // Normalize the current schema into the field names used by the matches page.
    const response = {
      matches: (data ?? []).map((match: any) => ({
        ...match,
        scheduled_at: match.scheduled_time,
        duration_seconds: match.duration_minutes ? match.duration_minutes * 60 : null,
        radiant_team_id: match.team_a_id,
        dire_team_id: match.team_b_id,
        radiant_team: teamById.has(match.team_a_id)
          ? { ...teamById.get(match.team_a_id), tag: teamById.get(match.team_a_id)?.name.slice(0, 4).toUpperCase() }
          : null,
        dire_team: teamById.has(match.team_b_id)
          ? { ...teamById.get(match.team_b_id), tag: teamById.get(match.team_b_id)?.name.slice(0, 4).toUpperCase() }
          : null,
        tournaments: tournamentBySeriesId.get(match.series_id) ?? null,
      })),
    };
    setCached(cacheKey, response, 60_000);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
