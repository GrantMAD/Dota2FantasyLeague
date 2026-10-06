import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/response-cache';
import { createErrorResponse, verifyAdminAuth } from '@/lib/auth-utils';

type PriceRow = {
  player_id: number;
  price: number | null;
  price_change: number | null;
  gameweek_id: number;
};
type ScoreRow = { player_id: number; total_points: number | null; gameweek_id: number };

type DynamicPlayerQuery<T> = {
  select: (columns: string) => DynamicPlayerQuery<T>;
  in: (column: string, values: number[]) => DynamicPlayerQuery<T>;
  order: (column: string, options: { ascending: boolean }) => DynamicPlayerQuery<T>;
  then: Promise<T>['then'];
};

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
    const rosteredOnly = searchParams.get('rostered') === 'true';
    const sortBy = searchParams.get('sort');
    const sortDesc = searchParams.get('desc') !== 'false'; // default true
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let query = supabase
      .from('professional_players')
      .select('*, professional_teams(name, logo_url)', { count: 'exact' });

    const showAll = searchParams.get('show_all') === 'true' || Boolean(search && search.trim().length > 0);
    if (!showAll) {
      query = query.eq('availability_status', 'available');
    }

    if (rosteredOnly) {
      query = query.not('team_id', 'is', null);
    }

    if (teamId) {
      query = query.eq('team_id', parseInt(teamId));
    }

    if (role) {
      if (role === 'Hard Support') {
        query = query.in('primary_role', ['Hard Support', 'Support']);
      } else if (role === 'Support') {
        query = query.in('primary_role', ['Support', 'Hard Support']);
      } else {
        query = query.eq('primary_role', role);
      }
    }

    const idsParam = searchParams.get('ids');
    if (idsParam) {
      const ids = idsParam.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id));
      if (ids.length > 0) {
        query = query.in('id', ids);
      }
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,in_game_name.ilike.%${search}%`);
    }

    if (sortBy === 'price') {
      query = query.order('current_price', { ascending: !sortDesc, nullsFirst: false });
    } else if (sortBy === 'name') {
      query = query.order('name', { ascending: !sortDesc });
    } else {
      query = query.order('name', { ascending: true });
    }
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch players', details: error.message },
        { status: 500 }
      );
    }

    const playerRows = data ?? [];
    const playerIds = playerRows.map((player) => player.id);
    // These tables are not included in the generated local schema typings.
    const [
      { data: prices, error: pricesError },
      { data: scores, error: scoresError },
    ] = await Promise.all([
      playerIds.length > 0
        ? (supabase.from('player_prices') as unknown as DynamicPlayerQuery<{ data: PriceRow[] | null; error: { message: string } | null }>)
            .select('player_id, price, price_change, gameweek_id')
            .in('player_id', playerIds)
            .order('gameweek_id', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      playerIds.length > 0
        ? (supabase.from('gameweek_scores') as unknown as DynamicPlayerQuery<{ data: ScoreRow[] | null; error: { message: string } | null }>)
            .select('player_id, total_points, gameweek_id')
            .in('player_id', playerIds)
            .order('gameweek_id', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (pricesError || scoresError) {
      const details = pricesError?.message ?? scoresError?.message;
      return NextResponse.json(
        { error: 'Failed to fetch player comparison data', details },
        { status: 500 }
      );
    }

    const latestPrices = new Map<number, number>();
    const latestPriceChanges = new Map<number, number | null>();
    for (const price of prices ?? []) {
      if (!latestPrices.has(price.player_id)) {
        latestPrices.set(price.player_id, Number(price.price ?? 0));
        latestPriceChanges.set(
          price.player_id,
          price.price_change == null ? null : Number(price.price_change),
        );
      }
    }
    const recentScoresByGameweek = new Map<number, Map<number, number>>();
    for (const score of scores ?? []) {
      const playerScores = recentScoresByGameweek.get(score.player_id) ?? new Map<number, number>();
      if (!playerScores.has(score.gameweek_id)) {
        playerScores.set(score.gameweek_id, Number(score.total_points ?? 0));
      }
      recentScoresByGameweek.set(score.player_id, playerScores);
    }
    const enrichedData = playerRows.map((player) => {
      const playerScores = [...(recentScoresByGameweek.get(player.id)?.entries() ?? [])]
        .sort(([gameweekA], [gameweekB]) => gameweekB - gameweekA)
        .slice(0, 5)
        .map(([, points]) => points);
      return {
        ...player,
        current_price: latestPrices.get(player.id) ?? (
          player.current_price == null ? null : Number(player.current_price)
        ),
        price_change: latestPriceChanges.get(player.id) ?? null,
        gameweek_points: playerScores[0] ?? 0,
        recent_points: playerScores.length ? Number((playerScores.reduce((sum, score) => sum + score, 0) / playerScores.length).toFixed(2)) : 0,
      };
    });

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
    await verifyAdminAuth(request);
    const body: unknown = await request.json();
    const allowedFields = [
      'name',
      'slug',
      'in_game_name',
      'team_id',
      'primary_role',
      'secondary_roles',
      'profile_image_url',
      'country',
      'data_provider_id',
      'availability_status',
      'last_synced_at',
      'current_price',
    ];
    if (
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).some((field) => !allowedFields.includes(field))
    ) {
      return NextResponse.json({ error: 'Invalid player fields.' }, { status: 400 });
    }

    const supabase = supabaseServer();
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
  } catch (error: unknown) {
    return createErrorResponse(error as Error);
  }
}
