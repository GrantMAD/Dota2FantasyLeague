import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/response-cache';
import { withApiTelemetry } from '@/lib/api-telemetry';
import { verifyAuth } from '@/lib/auth-utils';

type RawEntry = {
  id: number;
  rank?: number | null;
  global_rank?: number | null;
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

type LeaderboardRow = {
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

function mapEntry(entry: RawEntry, index: number, offset: number, gameweekId: string | null, previousRanks: Map<number, number>): LeaderboardRow {
  const season = getSeason(entry, gameweekId);
  const profile = season?.users ?? null;
  const squad = season?.fantasy_squads?.[0] ?? null;
  const rank = entry.rank ?? entry.global_rank ?? offset + index + 1;
  const fantasySeasonId = season?.id ?? entry.fantasy_season_id;

  return {
    id: entry.id,
    rank,
    previous_rank: fantasySeasonId ? previousRanks.get(fantasySeasonId) ?? null : null,
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

async function getPreviousRanks(
  supabase: ReturnType<typeof supabaseServer>,
  entries: RawEntry[],
  gameweekId: string | null,
): Promise<Map<number, number>> {
  const seasonIds = [...new Set(entries.map((entry) => getSeason(entry, gameweekId)?.season_id ?? entry.season_id).filter((id): id is number => typeof id === 'number'))];
  if (seasonIds.length === 0) return new Map();

  let previousGameweekIds: number[] = [];
  if (gameweekId) {
    const { data: selectedGameweek, error: selectedGameweekError } = await supabase
      .from('gameweeks')
      .select('id, season_id, end_date')
      .eq('id', gameweekId)
      .maybeSingle();
    if (selectedGameweekError) throw selectedGameweekError;

    if (selectedGameweek) {
      const { data: priorGameweek, error: priorGameweekError } = await supabase
        .from('gameweeks')
        .select('id')
        .eq('season_id', selectedGameweek.season_id)
        .eq('status', 'closed')
        .lt('end_date', selectedGameweek.end_date)
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (priorGameweekError) throw priorGameweekError;
      if (priorGameweek?.id) previousGameweekIds = [priorGameweek.id];
    }
  } else {
    const { data: closedGameweeks, error: gameweeksError } = await supabase
      .from('gameweeks')
      .select('id, season_id')
      .in('season_id', seasonIds)
      .eq('status', 'closed')
      .order('end_date', { ascending: false });
    if (gameweeksError) throw gameweeksError;

    const seenBySeason = new Map<number, number>();
    for (const gameweek of closedGameweeks ?? []) {
      const count = seenBySeason.get(gameweek.season_id) ?? 0;
      if (count === 1) previousGameweekIds.push(gameweek.id);
      seenBySeason.set(gameweek.season_id, count + 1);
    }
  }

  if (previousGameweekIds.length === 0) return new Map();

  const fantasySeasonIds = [...new Set(entries
    .map((entry) => getSeason(entry, gameweekId)?.id ?? entry.fantasy_season_id)
    .filter((id): id is number => typeof id === 'number'))];
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

/**
 * GET /api/leaderboard
 * Returns paginated global leaderboard from the latest ranking snapshots.
 * Query params: seasonId, gameweekId, country, page (default 1), limit (default 50)
 */
async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const gameweekId = searchParams.get('gameweekId');
    const country = searchParams.get('country')?.trim().toUpperCase() || null;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10));
    const offset = (page - 1) * limit;
    const cacheKey = `leaderboard:${searchParams.toString()}`;
    const cached = getCached<{
      leaderboard: LeaderboardRow[];
      pagination: { page: number; limit: number; total: number };
      lastRecalculatedAt: string | null;
      topGameweekScorer: { id: number; manager: string; points: number } | null;
    }>(cacheKey);

    const supabase = supabaseServer();
    let currentUserId: string | null = null;
    try {
      currentUserId = (await verifyAuth(request)).userId;
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'status' in error && error.status !== 401) {
        throw error;
      }
    }

    const sourceTable = gameweekId ? 'season_standings' : 'fantasy_seasons';
    const select = gameweekId
      ? `id, fantasy_season_id, rank, total_points, gameweek_points, fantasy_seasons!inner(id, user_id, season_id, users${country ? '!inner' : ''}(id, username, display_name, avatar_url, bio, country_code), fantasy_squads(id, name))`
      : `id, season_id, global_rank, total_points, gameweek_points_latest, user_id, users${country ? '!inner' : ''}(id, username, display_name, avatar_url, bio, country_code), fantasy_squads(id, name)`;

    let response = cached;
    if (!response) {
      // Keep the existing frontend response shape while reading the current schema.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from(sourceTable) as any)
        .select(select, { count: 'exact' })
        .order(gameweekId ? 'rank' : 'global_rank', { ascending: true, nullsFirst: false });

      if (seasonId && !gameweekId) query = query.eq('season_id', seasonId);
      if (gameweekId) query = query.eq('gameweek_id', gameweekId).is('league_id', null);
      if (country) query = query.eq(gameweekId ? 'fantasy_seasons.users.country_code' : 'users.country_code', country);

      const [{ data, error, count }, { data: recalculation, error: recalculationError }] = await Promise.all([
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
      ]);

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch leaderboard.', details: error.message },
          { status: 500 }
        );
      }
      if (recalculationError) {
        return NextResponse.json(
          { error: 'Failed to load the latest leaderboard update time.', details: recalculationError.message },
          { status: 500 },
        );
      }

      const rawEntries = (data ?? []) as RawEntry[];
      // The top scorer is calculated against the entire filtered leaderboard, not just this page.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let topQuery = (supabase.from(sourceTable) as any)
        .select(select)
        .order(gameweekId ? 'gameweek_points' : 'gameweek_points_latest', { ascending: false, nullsFirst: false })
        .limit(1);
      if (seasonId && !gameweekId) topQuery = topQuery.eq('season_id', seasonId);
      if (gameweekId) topQuery = topQuery.eq('gameweek_id', gameweekId).is('league_id', null);
      if (country) {
        topQuery = topQuery.eq(gameweekId ? 'fantasy_seasons.users.country_code' : 'users.country_code', country);
      }
      const { data: topScorer, error: topScorerError } = await topQuery.maybeSingle();
      if (topScorerError) {
        return NextResponse.json(
          { error: 'Failed to determine the top gameweek scorer.', details: topScorerError.message },
          { status: 500 },
        );
      }

      const previousRanks = await getPreviousRanks(supabase, rawEntries, gameweekId);
      const topScorerEntry = topScorer
        ? mapEntry(topScorer as RawEntry, 0, 0, gameweekId, new Map())
        : null;

      response = {
        leaderboard: rawEntries.map((entry, index) => mapEntry(entry, index, offset, gameweekId, previousRanks)),
        lastRecalculatedAt: recalculation?.completed_at ?? null,
        pagination: { page, limit, total: count ?? rawEntries.length },
        topGameweekScorer: topScorerEntry
          ? {
              id: topScorerEntry.id,
              manager: topScorerEntry.fantasy_teams.name,
              points: topScorerEntry.gameweek_points,
            }
          : null,
      };
      setCached(cacheKey, response, 60_000);
    }

    let leaderboard = response.leaderboard;
    if (currentUserId && !leaderboard.some((entry) => entry.fantasy_teams.user_id === currentUserId)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let currentUserQuery = (supabase.from(sourceTable) as any)
        .select(select)
        .order(gameweekId ? 'rank' : 'global_rank', { ascending: true, nullsFirst: false })
        .limit(1);
      if (seasonId && !gameweekId) currentUserQuery = currentUserQuery.eq('season_id', seasonId);
      if (gameweekId) currentUserQuery = currentUserQuery.eq('gameweek_id', gameweekId).is('league_id', null);
      if (country) {
        currentUserQuery = currentUserQuery.eq(gameweekId ? 'fantasy_seasons.users.country_code' : 'users.country_code', country);
      }
      currentUserQuery = currentUserQuery.eq(gameweekId ? 'fantasy_seasons.user_id' : 'user_id', currentUserId);
      const { data: currentUserEntry, error: currentUserError } = await currentUserQuery.maybeSingle();
      if (currentUserError) {
        return NextResponse.json(
          { error: 'Failed to load your leaderboard position.', details: currentUserError.message },
          { status: 500 },
        );
      }
      if (currentUserEntry && (currentUserEntry.rank ?? currentUserEntry.global_rank)) {
        const previousRanks = await getPreviousRanks(supabase, [currentUserEntry as RawEntry], gameweekId);
        leaderboard = [
          ...leaderboard,
          {
            ...mapEntry(currentUserEntry as RawEntry, leaderboard.length, offset + leaderboard.length, gameweekId, previousRanks),
            is_pinned: true,
          },
        ];
      }
    }

    return NextResponse.json({ ...response, leaderboard });
  } catch (error: unknown) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export const GET = withApiTelemetry('GET', '/api/leaderboard', getHandler);
