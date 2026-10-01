import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/response-cache';

interface MatchRecord {
  [column: string]: unknown;
  id: number;
  status: string;
  scheduled_time: string;
  duration_minutes: number | null;
  gameweek_id: number | null;
  series_id: number | null;
  match_number: number | null;
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
      const { data: seriesData, error: seriesError } = await supabase.from('tournament_series')
        .select('id')
        .eq('tournament_id', tournamentId);

      if (seriesError) {
        return NextResponse.json(
          { error: 'Failed to fetch tournament series.', details: seriesError.message },
          { status: 500 }
        );
      }

      const resolvedSeriesIds = ((seriesData ?? []) as { id: number }[]).map((item) => item.id);
      tournamentSeriesIds = resolvedSeriesIds;
      if (resolvedSeriesIds.length === 0) {
        return NextResponse.json({ matches: [] });
      }
    }

    let query = supabase.from('matches')
      .select(`
        id,
        status,
        scheduled_time,
        duration_minutes,
        gameweek_id,
        series_id,
        match_number,
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

    const matchRows = (data ?? []) as MatchRecord[];
    if (matchRows.length === 0) {
      const response = { matches: [] };
      setCached(cacheKey, response, 60_000);
      return NextResponse.json(response);
    }

    const teamIds = [...new Set(matchRows.flatMap((match) => [match.team_a_id, match.team_b_id]).filter((id): id is number => id !== null))];
    const seriesIds = [...new Set(matchRows.map((match) => match.series_id).filter((id): id is number => id !== null))];

    const [{ data: teamData, error: teamsError }, { data: seriesData, error: seriesError }] = await Promise.all([
      supabase.from('professional_teams').select('id, name, logo_url, region').in('id', teamIds),
      supabase.from('tournament_series').select('id, tournament_id, best_of, series_number').in('id', seriesIds),
    ]);

    if (teamsError || seriesError) {
      return NextResponse.json(
        { error: 'Failed to fetch match relationships.', details: teamsError?.message ?? seriesError?.message },
        { status: 500 }
      );
    }

    const teams = (teamData ?? []) as TeamRecord[];
    const series = (seriesData ?? []) as SeriesRecord[];
    const tournamentIds = [...new Set(series.map((item) => item.tournament_id).filter((id): id is number => id !== null))];
    const { data: tournamentData, error: tournamentsError } = await supabase.from('tournaments')
      .select('id, name, slug, tier')
      .in('id', tournamentIds);

    if (tournamentsError) {
      return NextResponse.json(
        { error: 'Failed to fetch match tournaments.', details: tournamentsError.message },
        { status: 500 }
      );
    }

    const tournaments = (tournamentData ?? []) as TournamentRecord[];
    const teamById = new Map(teams.map((team) => [team.id, team] as const));
    const tournamentById = new Map(tournaments.map((tournament) => [tournament.id, tournament] as const));
    const seriesMap = new Map(series.map((item) => [item.id, item] as const));

    // Normalize the current schema into the field names used by the matches page.
    const response = {
      matches: matchRows.map((match) => {
        const seriesInfo = match.series_id === null ? undefined : seriesMap.get(match.series_id);
        const radiantTeam = match.team_a_id === null ? undefined : teamById.get(match.team_a_id);
        const direTeam = match.team_b_id === null ? undefined : teamById.get(match.team_b_id);
        return {
          ...match,
          match_number: match.match_number || 1,
          best_of: seriesInfo?.best_of || 3,
          series_number: seriesInfo?.series_number || 1,
          scheduled_at: match.scheduled_time,
          duration_seconds: match.duration_minutes ? match.duration_minutes * 60 : null,
          radiant_team_id: match.team_a_id,
          dire_team_id: match.team_b_id,
          radiant_team: radiantTeam
            ? { ...radiantTeam, tag: radiantTeam.name.slice(0, 4).toUpperCase() }
            : null,
          dire_team: direTeam
            ? { ...direTeam, tag: direTeam.name.slice(0, 4).toUpperCase() }
            : null,
          tournaments: seriesInfo?.tournament_id != null ? tournamentById.get(seriesInfo.tournament_id) ?? null : null,
        };
      }),
    };
    setCached(cacheKey, response, 60_000);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
