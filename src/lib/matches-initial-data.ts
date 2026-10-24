import { supabaseServer } from '@/lib/supabase';
import { getTeamDisplayTag } from '@/lib/team-tag';
import { getCached, setCached } from '@/lib/response-cache';
import type { MatchData } from '@/app/(dashboard)/matches/components/MatchCard';

const PAGE_SIZE = 24;
const MATCH_COLUMNS = `
  id, status, scheduled_time, duration_minutes, gameweek_id, series_id,
  match_number, team_a_id, team_b_id, winner_team_id
`;

interface MatchRecord {
  id: number;
  status: string;
  scheduled_time: string;
  duration_minutes: number | null;
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

export interface InitialMatchesData {
  matches: MatchData[];
  tournaments: Array<{ id: number; name: string }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  counts: { all: number; live: number; upcoming: number; completed: number };
  activeGameweekId: number | null;
}

export async function getInitialMatchesData(): Promise<InitialMatchesData> {
  const cacheKey = 'matches:initial:v1';
  const cached = getCached<InitialMatchesData>(cacheKey);
  if (cached) return cached;

  const supabase = supabaseServer();
  const countQuery = (status?: string) => {
    let query = supabase.from('matches').select('id', { count: 'exact', head: true });
    if (status) query = query.eq('status', status);
    return query;
  };

  const [
    { data: matchRows, error: matchesError, count: total },
    { count: liveCount, error: liveError },
    { count: upcomingCount, error: upcomingError },
    { count: completedCount, error: completedError },
    { data: tournamentOptions, error: optionsError },
    { data: activeGameweek, error: gameweekError },
  ] = await Promise.all([
    supabase.from('matches')
      .select(MATCH_COLUMNS, { count: 'exact' })
      .order('scheduled_time', { ascending: false })
      .order('id', { ascending: false })
      .range(0, PAGE_SIZE - 1),
    countQuery('in_progress'),
    countQuery('scheduled'),
    countQuery('completed'),
    supabase.from('tournaments').select('id, name').order('name', { ascending: true }),
    supabase.from('gameweeks').select('id').eq('status', 'active').order('id', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (matchesError || liveError || upcomingError || completedError || optionsError || gameweekError) {
    const error = matchesError ?? liveError ?? upcomingError ?? completedError ?? optionsError ?? gameweekError;
    throw new Error(`Failed to load initial Match Center data: ${error?.message ?? 'Unknown database error.'}`);
  }

  const matches = (matchRows ?? []) as MatchRecord[];
  const teamIds = [...new Set(matches.flatMap((match) => [match.team_a_id, match.team_b_id]).filter((id): id is number => id !== null))];
  const seriesIds = [...new Set(matches.map((match) => match.series_id).filter((id): id is number => id !== null))];
  const [
    { data: teamRows, error: teamsError },
    { data: seriesRows, error: seriesError },
  ] = await Promise.all([
    teamIds.length
      ? supabase.from('professional_teams').select('id, name, slug, logo_url, region').in('id', teamIds)
      : Promise.resolve({ data: [], error: null }),
    seriesIds.length
      ? supabase.from('tournament_series').select('id, tournament_id, best_of, series_number').in('id', seriesIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (teamsError || seriesError) {
    const error = teamsError ?? seriesError;
    throw new Error(`Failed to load Match Center teams and series: ${error?.message ?? 'Unknown database error.'}`);
  }

  const teams = (teamRows ?? []) as TeamRecord[];
  const series = (seriesRows ?? []) as SeriesRecord[];
  const tournamentIds = [...new Set(series.map((item) => item.tournament_id).filter((id): id is number => id !== null))];
  const { data: tournamentRows, error: tournamentError } = tournamentIds.length
    ? await supabase.from('tournaments').select('id, name, slug, tier').in('id', tournamentIds)
    : { data: [], error: null };
  if (tournamentError) throw new Error(`Failed to load Match Center tournaments: ${tournamentError.message}`);

  const teamById = new Map((teams as TeamRecord[]).map((team) => [team.id, team] as const));
  const seriesById = new Map((series as SeriesRecord[]).map((item) => [item.id, item] as const));
  const tournamentById = new Map(((tournamentRows ?? []) as TournamentRecord[]).map((item) => [item.id, item] as const));
  const mappedMatches: MatchData[] = matches.map((match) => {
    const seriesInfo = match.series_id === null ? undefined : seriesById.get(match.series_id);
    const buildTeam = (teamId: number | null) => {
      if (teamId === null) return null;
      const team = teamById.get(teamId);
      return team ? { ...team, tag: getTeamDisplayTag(team.name) } : null;
    };
    return {
      ...match,
      status: match.status === 'in_progress' ? 'live' : match.status,
      match_number: match.match_number || 1,
      best_of: seriesInfo?.best_of || 3,
      series_number: seriesInfo?.series_number || 1,
      scheduled_at: match.scheduled_time,
      duration_seconds: match.duration_minutes ? match.duration_minutes * 60 : null,
      radiant_team_id: match.team_a_id ?? 0,
      dire_team_id: match.team_b_id ?? 0,
      radiant_team: buildTeam(match.team_a_id),
      dire_team: buildTeam(match.team_b_id),
      tournaments: seriesInfo?.tournament_id != null ? tournamentById.get(seriesInfo.tournament_id) ?? null : null,
    };
  });
  const matchTotal = total ?? matches.length;

  const response: InitialMatchesData = {
    matches: mappedMatches,
    tournaments: (tournamentOptions ?? []) as Array<{ id: number; name: string }>,
    pagination: { page: 1, limit: PAGE_SIZE, total: matchTotal, totalPages: Math.ceil(matchTotal / PAGE_SIZE) },
    counts: {
      all: matchTotal,
      live: liveCount ?? 0,
      upcoming: upcomingCount ?? 0,
      completed: completedCount ?? 0,
    },
    activeGameweekId: activeGameweek?.id ?? null,
  };
  setCached(cacheKey, response, 60_000);
  return response;
}
