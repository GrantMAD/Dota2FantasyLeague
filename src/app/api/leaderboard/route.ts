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

    // If no gameweekId provided, find the latest closed gameweek snapshot
    let resolvedGameweekId = gameweekId;
    if (!resolvedGameweekId && seasonId) {
      const { data: latestGw } = await (supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('gameweeks') as any)
        .select('id')
        .eq('season_id', seasonId)
        .eq('status', 'closed')
        .order('gameweek_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      resolvedGameweekId = latestGw?.id?.toString() ?? null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('leaderboard_snapshots') as any)
      .select(`
        id,
        rank,
        previous_rank,
        total_points,
        gameweek_points,
        created_at,
        fantasy_teams(
          id,
          name,
          user_id,
          profiles(id, username, display_name, avatar_url, country)
        )
      `)
      .order('rank', { ascending: true })
      .range(offset, offset + limit - 1);

    if (seasonId) query = query.eq('season_id', seasonId);
    if (resolvedGameweekId) query = query.eq('gameweek_id', resolvedGameweekId);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard.', details: error.message },
        { status: 500 }
      );
    }

    // Apply country filter in memory if needed (profile country is nested)
    let entries = data ?? [];
    if (country) {
      entries = entries.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (entry: any) => entry.fantasy_teams?.profiles?.country === country
      );
    }

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
