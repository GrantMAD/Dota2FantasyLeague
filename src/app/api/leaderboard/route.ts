import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/response-cache';

/**
 * GET /api/leaderboard
 * Returns paginated global leaderboard from the latest ranking snapshots.
 * Query params: seasonId, gameweekId, country, page (default 1), limit (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const gameweekId = searchParams.get('gameweekId');
    const country = searchParams.get('country');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10));
    const offset = (page - 1) * limit;
    const cacheKey = `leaderboard:${searchParams.toString()}`;
    const cached = getCached<{ leaderboard: unknown[]; pagination: unknown }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const supabase = supabaseServer();

    const sourceTable = gameweekId ? 'season_standings' : 'fantasy_seasons';
    const select = gameweekId
      ? `id, rank, total_points, gameweek_points, fantasy_seasons(id, user_id, users(id, username, display_name, avatar_url), fantasy_squads(id, name))`
      : `id, global_rank, total_points, gameweek_points_latest, user_id, users(id, username, display_name, avatar_url), fantasy_squads(id, name)`;

    // Keep the existing frontend response shape while reading the current schema.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from(sourceTable) as any)
      .select(select, { count: 'exact' })
      .order(gameweekId ? 'rank' : 'global_rank', { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (seasonId && !gameweekId) query = query.eq('season_id', seasonId);
    if (gameweekId) query = query.eq('gameweek_id', gameweekId);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard.', details: error.message },
        { status: 500 }
      );
    }

    // The current users schema does not contain a country column, so country is
    // retained as a compatible query parameter but cannot filter these records.
    void country;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries = (data ?? []).map((entry: any, index: number) => {
      const season = gameweekId ? entry.fantasy_seasons : entry;
      const profile = season?.users ?? null;
      const squad = season?.fantasy_squads?.[0] ?? null;
      const rank = entry.rank ?? entry.global_rank ?? offset + index + 1;

      return {
        id: entry.id,
        rank,
        previous_rank: null,
        total_points: entry.total_points ?? 0,
        gameweek_points: entry.gameweek_points ?? entry.gameweek_points_latest ?? 0,
        created_at: entry.created_at ?? null,
        fantasy_teams: {
          id: season?.id,
          name: squad?.name ?? profile?.display_name ?? profile?.username ?? 'Unknown Team',
          user_id: season?.user_id,
          profiles: profile ? { ...profile, country: null } : null,
        },
      };
    });

    const response = {
      leaderboard: entries,
      pagination: {
        page,
        limit,
        total: count ?? entries.length,
      },
    };
    setCached(cacheKey, response, 60_000);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
