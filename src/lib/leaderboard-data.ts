import { supabaseServer } from '@/lib/supabase';

export type RawEntry = {
  id: number;
  rank?: number | null;
  global_rank?: number | null;
  previous_rank?: number | null;
  total_points?: number | null;
  gameweek_points?: number | null;
  gameweek_points_latest?: number | null;
  created_at?: string | null;
  fantasy_season_id?: number;
  season_id?: number;
  fantasy_seasons?: {
    id?: number;
    user_id?: string;
    season_id?: number;
    users?: Profile | null;
    fantasy_squads?: Squad[] | null;
  } | null;
  user_id?: string;
  users?: Profile | null;
  fantasy_squads?: Squad[] | null;
};

type Profile = {
  id?: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  country_code?: string | null;
};

type Squad = { id: number; name: string | null };

export type LeaderboardRow = {
  id: number;
  rank: number;
  previous_rank: number | null;
  total_points: number;
  gameweek_points: number;
  created_at: string | null;
  is_pinned?: boolean;
  fantasy_teams: {
    id?: number;
    name: string;
    user_id?: string;
    profiles: (Profile & { country?: string | null }) | null;
  };
};

export type LeaderboardData = {
  leaderboard: LeaderboardRow[];
  pagination: { page: number; limit: number; total: number };
  lastRecalculatedAt: string | null;
  topGameweekScorer: { id: number; manager: string; points: number } | null;
};

export type LeaderboardQuery = {
  seasonId: string | null;
  gameweekId: string | null;
  country: string | null;
  page: number;
  limit: number;
};

export class LeaderboardDataError extends Error {
  constructor(
    publicMessage: string,
    public readonly details: string,
  ) {
    super(publicMessage);
    this.name = 'LeaderboardDataError';
  }
}

function formatCountry(countryCode: string | null | undefined): string | null {
  if (!countryCode) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode.toUpperCase()) ?? countryCode;
  } catch {
    return countryCode;
  }
}

function getSeason(entry: RawEntry, gameweekId: string | null) {
  return gameweekId ? entry.fantasy_seasons : entry;
}

export function mapLeaderboardEntry(
  entry: RawEntry,
  index: number,
  offset: number,
  gameweekId: string | null,
  previousRanks: Map<number, number>,
): LeaderboardRow {
  const season = getSeason(entry, gameweekId);
  const profile = season?.users ?? null;
  const squad = season?.fantasy_squads?.[0] ?? null;
  const rank = entry.rank ?? entry.global_rank ?? offset + index + 1;
  const fantasySeasonId = season?.id ?? entry.fantasy_season_id;

  return {
    id: entry.id,
    rank,
    previous_rank: gameweekId
      ? fantasySeasonId ? previousRanks.get(fantasySeasonId) ?? null : null
      : entry.previous_rank ?? null,
    total_points: entry.total_points ?? 0,
    gameweek_points: entry.gameweek_points ?? entry.gameweek_points_latest ?? 0,
    created_at: entry.created_at ?? null,
    fantasy_teams: {
      id: fantasySeasonId,
      name: squad?.name ?? profile?.display_name ?? profile?.username ?? 'Unknown Team',
      user_id: season?.user_id ?? entry.user_id,
      profiles: profile ? { ...profile, country: formatCountry(profile.country_code) } : null,
    },
  };
}

export async function getPreviousRanks(
  supabase: ReturnType<typeof supabaseServer>,
  entries: RawEntry[],
  gameweekId: string | null,
): Promise<Map<number, number>> {
  if (!gameweekId) return new Map();
  const seasonIds = [...new Set(
    entries
      .map((entry) => getSeason(entry, gameweekId)?.season_id ?? entry.season_id)
      .filter((id): id is number => typeof id === 'number'),
  )];
  if (seasonIds.length === 0) return new Map();

  const { data: gameweeks, error: gameweeksError } = await supabase
    .from('gameweeks')
    .select('id, season_id, end_date, status')
    .in('season_id', seasonIds)
    .order('end_date', { ascending: false });
  if (gameweeksError) throw gameweeksError;

  const previousGameweekIds: number[] = [];
  for (const seasonId of seasonIds) {
    const seasonGameweeks = (gameweeks ?? []).filter((gameweek) => gameweek.season_id === seasonId);
    if (gameweekId) {
      const selectedGameweek = seasonGameweeks.find((gameweek) => String(gameweek.id) === gameweekId);
      if (!selectedGameweek) continue;
      const previousGameweek = seasonGameweeks.find(
        (gameweek) => gameweek.status === 'closed' && gameweek.end_date < selectedGameweek.end_date,
      );
      if (previousGameweek) previousGameweekIds.push(previousGameweek.id);
      continue;
    }

    const closedGameweeks = seasonGameweeks.filter((gameweek) => gameweek.status === 'closed');
    if (closedGameweeks[1]) previousGameweekIds.push(closedGameweeks[1].id);
  }
  if (previousGameweekIds.length === 0) return new Map();

  const fantasySeasonIds = [...new Set(
    entries
      .map((entry) => getSeason(entry, gameweekId)?.id ?? entry.fantasy_season_id)
      .filter((id): id is number => typeof id === 'number'),
  )];
  if (fantasySeasonIds.length === 0) return new Map();

  const { data: standings, error: standingsError } = await supabase
    .from('season_standings')
    .select('fantasy_season_id, rank')
    .in('fantasy_season_id', fantasySeasonIds)
    .in('gameweek_id', previousGameweekIds)
    .is('league_id', null);
  if (standingsError) throw standingsError;

  return new Map((standings ?? []).map((standing) => [standing.fantasy_season_id, standing.rank]));
}

export async function getCurrentUserLeaderboardEntry(
  supabase: ReturnType<typeof supabaseServer>,
  userId: string,
  { seasonId, gameweekId, country }: Pick<LeaderboardQuery, 'seasonId' | 'gameweekId' | 'country'>,
): Promise<LeaderboardRow | null> {
  const sourceTable = gameweekId ? 'season_standings' : 'fantasy_seasons';
  const select = gameweekId
    ? `id, fantasy_season_id, rank, total_points, gameweek_points, fantasy_seasons!inner(id, user_id, season_id, users${country ? '!inner' : ''}(id, username, display_name, avatar_url, bio, country_code), fantasy_squads(id, name))`
    : `id, season_id, global_rank, previous_rank, total_points, gameweek_points_latest, user_id, users${country ? '!inner' : ''}(id, username, display_name, avatar_url, bio, country_code), fantasy_squads(id, name)`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from(sourceTable) as any)
    .select(select)
    .order(gameweekId ? 'rank' : 'global_rank', { ascending: true, nullsFirst: false })
    .limit(1);
  if (seasonId && !gameweekId) query = query.eq('season_id', seasonId);
  if (gameweekId) query = query.eq('gameweek_id', gameweekId).is('league_id', null);
  if (country) {
    query = query.eq(gameweekId ? 'fantasy_seasons.users.country_code' : 'users.country_code', country);
  }
  query = query.eq(gameweekId ? 'fantasy_seasons.user_id' : 'user_id', userId);

  const { data, error } = await query.maybeSingle();
  if (error) throw new LeaderboardDataError('Failed to load your leaderboard position.', error.message);
  if (!data || !(data.rank ?? data.global_rank)) return null;

  const entry = data as RawEntry;
  const previousRanks = await getPreviousRanks(supabase, [entry], gameweekId);
  return mapLeaderboardEntry(entry, 0, 0, gameweekId, previousRanks);
}

export async function getLeaderboardData(
  supabase: ReturnType<typeof supabaseServer>,
  { seasonId, gameweekId, country, page, limit }: LeaderboardQuery,
): Promise<LeaderboardData> {
  const offset = (page - 1) * limit;
  const sourceTable = gameweekId ? 'season_standings' : 'fantasy_seasons';
  const select = gameweekId
    ? `id, fantasy_season_id, rank, total_points, gameweek_points, fantasy_seasons!inner(id, user_id, season_id, users${country ? '!inner' : ''}(id, username, display_name, avatar_url, bio, country_code), fantasy_squads(id, name))`
    : `id, season_id, global_rank, previous_rank, total_points, gameweek_points_latest, user_id, users${country ? '!inner' : ''}(id, username, display_name, avatar_url, bio, country_code), fantasy_squads(id, name)`;

  // Keep the existing frontend response shape while reading the current schema.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from(sourceTable) as any)
    .select(select, { count: 'exact' })
    .order(gameweekId ? 'rank' : 'global_rank', { ascending: true, nullsFirst: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let topQuery = (supabase.from(sourceTable) as any)
    .select(select)
    .order(gameweekId ? 'gameweek_points' : 'gameweek_points_latest', { ascending: false, nullsFirst: false })
    .limit(1);

  if (seasonId && !gameweekId) {
    query = query.eq('season_id', seasonId);
    topQuery = topQuery.eq('season_id', seasonId);
  }
  if (gameweekId) {
    query = query.eq('gameweek_id', gameweekId).is('league_id', null);
    topQuery = topQuery.eq('gameweek_id', gameweekId).is('league_id', null);
  }
  if (country) {
    const countryColumn = gameweekId ? 'fantasy_seasons.users.country_code' : 'users.country_code';
    query = query.eq(countryColumn, country);
    topQuery = topQuery.eq(countryColumn, country);
  }

  const [
    { data, error, count },
    { data: recalculation, error: recalculationError },
    { data: topScorer, error: topScorerError },
  ] = await Promise.all([
    query.range(offset, offset + limit - 1),
    supabase
      .from('job_execution_log')
      .select('completed_at')
      .eq('job_name', 'calculate-global-rankings')
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    topQuery.maybeSingle(),
  ]);

  if (error) throw new LeaderboardDataError('Failed to fetch leaderboard.', error.message);
  if (recalculationError) {
    throw new LeaderboardDataError('Failed to load the latest leaderboard update time.', recalculationError.message);
  }
  if (topScorerError) {
    throw new LeaderboardDataError('Failed to determine the top gameweek scorer.', topScorerError.message);
  }

  const rawEntries = (data ?? []) as RawEntry[];
  const previousRanks = await getPreviousRanks(supabase, rawEntries, gameweekId);
  const mappedTopScorer = topScorer
    ? mapLeaderboardEntry(topScorer as RawEntry, 0, 0, gameweekId, new Map())
    : null;

  return {
    leaderboard: rawEntries.map((entry, index) => mapLeaderboardEntry(entry, index, offset, gameweekId, previousRanks)),
    lastRecalculatedAt: recalculation?.completed_at ?? null,
    pagination: { page, limit, total: count ?? rawEntries.length },
    topGameweekScorer: mappedTopScorer
      ? {
          id: mappedTopScorer.id,
          manager: mappedTopScorer.fantasy_teams.name,
          points: mappedTopScorer.gameweek_points,
        }
      : null,
  };
}
