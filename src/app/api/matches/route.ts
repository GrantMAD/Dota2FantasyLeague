import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';
import { getTeamDisplayTag } from '@/lib/team-tag';
import { getMatchSeriesKey } from '@/lib/match-series';

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
  slug: string;
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

const MATCH_COLUMNS = `
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
`;
const MAX_PAGE_SIZE = 100;
const VALID_STATUSES = new Set(['all', 'live', 'upcoming', 'scheduled', 'completed']);
const PUBLIC_CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' };

function databaseError(operation: string, error: { message: string }) {
  console.error(`[Matches API] ${operation} failed:`, error);
  return NextResponse.json(
    { error: `Failed to ${operation}.`, details: error.message },
    { status: 500 }
  );
}

function parsePositiveInteger(value: string | null, fallback: number): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveIntegerList(value: string | null, maxItems: number): number[] | null {
  if (value === null) return [];
  const parts = value.split(',');
  if (parts.length === 0 || parts.length > maxItems) return null;
  const parsed = parts.map((part) => parsePositiveInteger(part, 0));
  if (parsed.some((item) => item === null)) return null;
  const ids = parsed.filter((item): item is number => item !== null);
  return new Set(ids).size === ids.length ? ids : null;
}

function escapeLikeTerm(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function buildMatchQuery(
  supabase: ReturnType<typeof supabaseServer>,
  filters: {
    countOnly?: boolean;
    ascending: boolean;
    gameweekId: number | null;
    tournamentSeriesIds: number[] | null;
    teamId: number | null;
    teamIds: number[];
    searchTeamIds: number[];
    searchSeriesIds: number[];
    status: string;
    page: number;
    limit: number;
  }
) {
  let query = supabase.from('matches')
    .select(MATCH_COLUMNS, { count: 'exact', head: filters.countOnly ?? false })
    .order('scheduled_time', { ascending: filters.ascending })
    .order('id', { ascending: filters.ascending });

  if (filters.gameweekId !== null) query = query.eq('gameweek_id', filters.gameweekId);
  if (filters.tournamentSeriesIds !== null) query = query.in('series_id', filters.tournamentSeriesIds);
  if (filters.teamId !== null) {
    query = query.or(`team_a_id.eq.${filters.teamId},team_b_id.eq.${filters.teamId}`);
  } else if (filters.teamIds.length > 0) {
    const teamIds = filters.teamIds.join(',');
    query = query.or(`team_a_id.in.(${teamIds}),team_b_id.in.(${teamIds})`);
  }

  const searchConditions = [
    ...(filters.searchTeamIds.length > 0
      ? [`team_a_id.in.(${filters.searchTeamIds.join(',')})`, `team_b_id.in.(${filters.searchTeamIds.join(',')})`]
      : []),
    ...(filters.searchSeriesIds.length > 0
      ? [`series_id.in.(${filters.searchSeriesIds.join(',')})`]
      : []),
  ];
  if (searchConditions.length > 0) query = query.or(searchConditions.join(','));

  if (filters.status === 'live') query = query.eq('status', 'in_progress');
  else if (filters.status === 'upcoming') query = query.eq('status', 'scheduled');
  else if (filters.status !== 'all') query = query.eq('status', filters.status);

  if (!filters.countOnly) {
    const from = (filters.page - 1) * filters.limit;
    query = query.range(from, from + filters.limit - 1);
  }
  return query;
}

/**
 * GET /api/matches
 * Returns a paginated match slice filtered by gameweekId, tournamentId, teamId,
 * status, and a team/tournament search term.
 */
async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get('page'), 1);
    const limit = parsePositiveInteger(searchParams.get('limit'), 50);
    const gameweekId = parsePositiveInteger(searchParams.get('gameweekId'), 0);
    const tournamentId = parsePositiveInteger(searchParams.get('tournamentId'), 0);
    const teamId = parsePositiveInteger(searchParams.get('teamId'), 0);
    const teamIdsParam = searchParams.get('teamIds');
    const teamFilterIds = parsePositiveIntegerList(teamIdsParam, 50);
    const status = searchParams.get('status') ?? 'all';
    const search = (searchParams.get('search') ?? '').trim().slice(0, 80);
    const ascending = searchParams.get('order') === 'asc';

    if (
      page === null ||
      limit === null ||
      limit > MAX_PAGE_SIZE ||
      !Number.isSafeInteger((page - 1) * limit) ||
      gameweekId === null ||
      tournamentId === null ||
      teamId === null ||
      teamFilterIds === null ||
      (teamIdsParam !== null && teamId > 0) ||
      !VALID_STATUSES.has(status)
    ) {
      return NextResponse.json({ error: 'Invalid match filters or pagination parameters.' }, { status: 400 });
    }

    const supabase = supabaseServer();
    let tournamentSeriesIds: number[] | null = null;

    if (tournamentId > 0) {
      const { data: seriesData, error: seriesError } = await supabase.from('tournament_series')
        .select('id')
        .eq('tournament_id', tournamentId);

      if (seriesError) {
        return databaseError('fetch tournament series', seriesError);
      }
      tournamentSeriesIds = ((seriesData ?? []) as { id: number }[]).map((item) => item.id);
      if (tournamentSeriesIds.length === 0) {
        const response = {
          matches: [],
          tournaments: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          counts: { all: 0, live: 0, upcoming: 0, completed: 0 },
        };
        return NextResponse.json(response, { headers: PUBLIC_CACHE_HEADERS });
      }
    }

    let searchTeamIds: number[] = [];
    let searchSeriesIds: number[] = [];
    if (search) {
      const pattern = `%${escapeLikeTerm(search)}%`;
      const [{ data: teams, error: teamsError }, { data: tournaments, error: tournamentsError }] = await Promise.all([
        supabase.from('professional_teams').select('id').ilike('name', pattern),
        supabase.from('tournaments').select('id').ilike('name', pattern),
      ]);
      if (teamsError || tournamentsError) {
        const error = teamsError ?? tournamentsError;
        if (error) return databaseError('search match teams and tournaments', error);
      }
      searchTeamIds = ((teams ?? []) as { id: number }[]).map((team) => team.id);
      const tournamentIds = ((tournaments ?? []) as { id: number }[]).map((tournament) => tournament.id);
      if (tournamentIds.length > 0) {
        const { data: series, error: searchSeriesError } = await supabase.from('tournament_series')
          .select('id')
          .in('tournament_id', tournamentIds);
        if (searchSeriesError) {
          return databaseError('search match tournaments', searchSeriesError);
        }
        searchSeriesIds = ((series ?? []) as { id: number }[]).map((item) => item.id);
      }
      if (searchTeamIds.length === 0 && searchSeriesIds.length === 0) {
        const response = {
          matches: [],
          tournaments: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          counts: { all: 0, live: 0, upcoming: 0, completed: 0 },
        };
        return NextResponse.json(response, { headers: PUBLIC_CACHE_HEADERS });
      }
    }

    const commonFilters = {
      ascending,
      gameweekId: gameweekId || null,
      tournamentSeriesIds,
      teamId: teamId || null,
      teamIds: teamFilterIds,
      searchTeamIds,
      searchSeriesIds,
      page,
      limit,
    };
    const countStatuses = [
      ['all', 'all'],
      ['live', 'live'],
      ['upcoming', 'upcoming'],
      ['completed', 'completed'],
    ] as const;
    const [matchResult, ...countResults] = await Promise.all([
      buildMatchQuery(supabase, { ...commonFilters, status }).then((result) => result),
      ...countStatuses.map(([, countStatus]) =>
        buildMatchQuery(supabase, { ...commonFilters, status: countStatus, countOnly: true })
      ),
    ]);

    if (matchResult.error || countResults.some((result) => result.error)) {
      const error = matchResult.error ?? countResults.find((result) => result.error)?.error;
      return databaseError('fetch matches', error ?? { message: 'Unknown database error.' });
    }

    const matchRows = (matchResult.data ?? []) as MatchRecord[];
    const total = matchResult.count ?? 0;
    const pageSeriesIds = [...new Set(matchRows.map((match) => match.series_id).filter((id): id is number => id !== null))];
    const { data: siblingMatchRows, error: siblingMatchesError } = pageSeriesIds.length > 0
      ? await supabase.from('matches')
        .select(MATCH_COLUMNS)
        .in('series_id', pageSeriesIds)
        .order('scheduled_time', { ascending: true })
        .order('id', { ascending: true })
      : { data: [], error: null };
    if (siblingMatchesError) {
      return databaseError('fetch match series games', siblingMatchesError);
    }

    const pageSeriesKeys = new Set(matchRows.map(getMatchSeriesKey));
    const scopedSiblingMatchRows = ((siblingMatchRows ?? []) as MatchRecord[])
      .filter((match) => pageSeriesKeys.has(getMatchSeriesKey(match)));
    const allMatchesById = new Map<number, MatchRecord>();
    for (const match of [...scopedSiblingMatchRows, ...matchRows]) {
      allMatchesById.set(match.id, match);
    }
    const allMatchRows = [...allMatchesById.values()];
    const matchIds = allMatchRows.map((match) => match.id);
    const { data: matchPlayerStats, error: matchPlayerStatsError } = matchIds.length > 0
      ? await (supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from('match_player_stats') as any)
          .select('match_id, player_id')
          .in('match_id', matchIds)
      : { data: [], error: null };
    if (matchPlayerStatsError) {
      return databaseError('fetch match player participation', matchPlayerStatsError);
    }

    const playerIdsByMatch = new Map<number, number[]>();
    for (const stat of (matchPlayerStats ?? []) as Array<{ match_id: number; player_id: number }>) {
      const playerIds = playerIdsByMatch.get(stat.match_id) ?? [];
      playerIds.push(stat.player_id);
      playerIdsByMatch.set(stat.match_id, playerIds);
    }

    const teamIds = [...new Set(allMatchRows.flatMap((match) => [match.team_a_id, match.team_b_id]).filter((id): id is number => id !== null))];
    const seriesIds = [...new Set(allMatchRows.map((match) => match.series_id).filter((id): id is number => id !== null))];

    const [
      { data: teamData, error: teamsError },
      { data: seriesData, error: seriesError },
      { data: tournamentOptionsData, error: tournamentOptionsError },
    ] = await Promise.all([
      teamIds.length > 0
        ? supabase.from('professional_teams').select('id, name, slug, logo_url, region').in('id', teamIds)
        : Promise.resolve({ data: [], error: null }),
      seriesIds.length > 0
        ? supabase.from('tournament_series').select('id, tournament_id, best_of, series_number').in('id', seriesIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('tournaments').select('id, name').order('name', { ascending: true }),
    ]);

    if (teamsError || seriesError || tournamentOptionsError) {
      const error = teamsError ?? seriesError ?? tournamentOptionsError;
      if (error) return databaseError('fetch match relationships', error);
    }

    const teams = (teamData ?? []) as TeamRecord[];
    const series = (seriesData ?? []) as SeriesRecord[];
    const tournamentIds = [...new Set(series.map((item) => item.tournament_id).filter((id): id is number => id !== null))];
    const { data: tournamentData, error: tournamentsError } = tournamentIds.length > 0
      ? await supabase.from('tournaments').select('id, name, slug, tier').in('id', tournamentIds)
      : { data: [], error: null };

    if (tournamentsError) {
      return databaseError('fetch match tournaments', tournamentsError);
    }

    const tournaments = (tournamentData ?? []) as TournamentRecord[];
    const teamById = new Map(teams.map((team) => [team.id, team] as const));
    const tournamentById = new Map(tournaments.map((tournament) => [tournament.id, tournament] as const));
    const seriesMap = new Map(series.map((item) => [item.id, item] as const));
    const counts = Object.fromEntries(countStatuses.map(([key], index) => [key, countResults[index].count ?? 0]));

    const mappedMatches = allMatchRows.map((match) => {
        const seriesInfo = match.series_id === null ? undefined : seriesMap.get(match.series_id);
        const buildTeam = (teamId: number | null) => {
          if (teamId === null) return null;
          const team = teamById.get(teamId);
          return team ? { ...team, tag: getTeamDisplayTag(team.name) } : null;
        };
        return {
          ...match,
          player_ids: playerIdsByMatch.get(match.id) ?? [],
          status: match.status === 'in_progress' ? 'live' : match.status,
          match_number: match.match_number ?? undefined,
          best_of: seriesInfo?.best_of || 3,
          series_number: seriesInfo?.series_number || 1,
          scheduled_at: match.scheduled_time,
          duration_seconds: match.duration_minutes ? match.duration_minutes * 60 : null,
          radiant_team_id: match.team_a_id,
          dire_team_id: match.team_b_id,
          radiant_team: buildTeam(match.team_a_id),
          dire_team: buildTeam(match.team_b_id),
          tournaments: seriesInfo?.tournament_id != null ? tournamentById.get(seriesInfo.tournament_id) ?? null : null,
        };
      });
    const mappedById = new Map(mappedMatches.map((match) => [match.id, match]));
    const siblingMatchesBySeries = new Map<string, typeof mappedMatches>();
    for (const match of mappedMatches) {
      if (match.series_id === null) continue;
      const seriesKey = getMatchSeriesKey(match);
      const games = siblingMatchesBySeries.get(seriesKey) ?? [];
      games.push(match);
      siblingMatchesBySeries.set(seriesKey, games);
    }
    for (const games of siblingMatchesBySeries.values()) {
      games.sort((left, right) => left.scheduled_time.localeCompare(right.scheduled_time) || left.id - right.id);
      games.forEach((game, index) => {
        if (!game.match_number || game.match_number < 1) game.match_number = index + 1;
      });
    }
    const pageMatches = matchRows.map((match) => {
      const mappedMatch = mappedById.get(match.id);
      if (!mappedMatch || mappedMatch.series_id === null) return mappedMatch;
      return {
        ...mappedMatch,
        series_matches: siblingMatchesBySeries.get(getMatchSeriesKey(mappedMatch)) ?? [mappedMatch],
      };
    }).filter((match): match is NonNullable<typeof match> => match !== undefined);

    const response = {
      matches: pageMatches,
      tournaments: ((tournamentOptionsData ?? []) as Array<{ id: number; name: string }>),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts,
    };
    return NextResponse.json(response, { headers: PUBLIC_CACHE_HEADERS });
  } catch (error) {
    console.error('[Matches API] Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export const GET = withApiTelemetry('GET', '/api/matches', getHandler);
