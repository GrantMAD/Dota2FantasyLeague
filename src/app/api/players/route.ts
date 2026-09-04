import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/response-cache';

/**
 * GET /api/players - Fetch all professional players
 * Query params:
 *   - season_id: Filter by season (optional)
 *   - team_id: Filter by team (optional)
 *   - role: Filter by role (optional)
 *   - limit: Limit results (default: 100)
 *   - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const searchParams = request.nextUrl.searchParams;
    const cacheKey = `players:${searchParams.toString()}`;
    const cached = getCached<{ data: unknown[]; total: number | null; limit: number; offset: number }>(cacheKey);
    if (cached) return NextResponse.json(cached);
    
    const teamId = searchParams.get('team_id');
    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sort');
    const sortDesc = searchParams.get('desc') !== 'false'; // default true
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let query = supabase
      .from('professional_players')
      .select('*, professional_teams(name, logo_url)', { count: 'exact' });

    if (teamId) {
      query = query.eq('team_id', parseInt(teamId));
    }

    if (role) {
      query = query.eq('primary_role', role);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,in_game_name.ilike.%${search}%`);
    }

    if (sortBy !== 'price') {
      if (sortBy === 'name') {
        query = query.order('name', { ascending: !sortDesc });
      } else {
        query = query.order('name', { ascending: true });
      }
      query = query.range(offset, offset + limit - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch players', details: error.message },
        { status: 500 }
      );
    }

    const playerRows = data ?? [];
    const playerIds = playerRows.map((player) => player.id);
    // These tables are dynamic in the local schema typings, so keep the cast at this boundary.
    const [{ data: prices }, { data: scores }] = await Promise.all([
      (supabase.from('player_prices') as any)
        .select('player_id, price, gameweek_id')
        .in('player_id', playerIds)
        .order('gameweek_id', { ascending: false }),
      (supabase.from('gameweek_scores') as any)
        .select('player_id, total_points, gameweek_id')
        .in('player_id', playerIds)
        .order('gameweek_id', { ascending: false }),
    ]);
    const latestPrices = new Map<number, number>();
    for (const price of prices ?? []) {
      if (!latestPrices.has(price.player_id)) latestPrices.set(price.player_id, Number(price.price ?? 0));
    }
    const recentScores = new Map<number, number[]>();
    for (const score of scores ?? []) {
      const playerScores = recentScores.get(score.player_id) ?? [];
      if (playerScores.length < 5) playerScores.push(Number(score.total_points ?? 0));
      recentScores.set(score.player_id, playerScores);
    }
    let enrichedData = playerRows.map((player) => {
      const playerScores = recentScores.get(player.id) ?? [];
      return {
        ...player,
        current_price: latestPrices.get(player.id) ?? 0,
        gameweek_points: playerScores[0] ?? 0,
        recent_points: playerScores.length ? Number((playerScores.reduce((sum, score) => sum + score, 0) / playerScores.length).toFixed(2)) : 0,
      };
    });

    if (sortBy === 'price') {
      enrichedData.sort((a, b) => {
        const diff = (b.current_price ?? 0) - (a.current_price ?? 0);
        return sortDesc ? diff : -diff;
      });
      enrichedData = enrichedData.slice(offset, offset + limit);
    }

    const response = { data: enrichedData, total: count, limit, offset };
    setCached(cacheKey, response, 60_000);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/players - Create a new professional player (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const body = await request.json();
    
    // TODO: Add admin authorization check
    
    const { data, error } = await supabase
      .from('professional_players')
      .insert([body])
      .select();
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to create player', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
