type PriceRow = {
  player_id: number;
  price: number | null;
  price_change: number | null;
  ownership_percentage: number | null;
  gameweek_id: number;
};

type ScoreRow = {
  player_id: number;
  total_points: number | null;
  gameweek_id: number;
};

type DynamicPlayerQuery<T> = {
  select: (columns: string) => DynamicPlayerQuery<T>;
  in: (column: string, values: number[]) => DynamicPlayerQuery<T>;
  order: (column: string, options: { ascending: boolean }) => DynamicPlayerQuery<T>;
  limit: (count: number) => DynamicPlayerQuery<T>;
  then: Promise<T>['then'];
};

export interface PlayersCatalogResponse {
  data: Array<{
    id: number;
    name: string;
    in_game_name: string | null;
    primary_role: string;
    current_price: number;
    price_change?: number | null;
    ownership_percentage?: number | null;
    professional_teams?: { name: string; logo_url: string | null } | null;
    availability_status: string;
    profile_image_url?: string | null;
    [key: string]: unknown;
  }>;
  total: number | null;
  limit: number;
  offset: number;
}

export class PlayersCatalogError extends Error {
  constructor(
    public readonly responseMessage: string,
    public readonly details: string,
  ) {
    super(responseMessage);
    this.name = 'PlayersCatalogError';
  }
}

export async function getPlayersCatalogData(
  supabase: ReturnType<typeof import('@/lib/supabase').supabaseServer>,
  searchParams: URLSearchParams,
): Promise<PlayersCatalogResponse> {
  const teamId = searchParams.get('team_id');
  const role = searchParams.get('role');
  const search = searchParams.get('search');
  const rosteredOnly = searchParams.get('rostered') === 'true';
  const sortBy = searchParams.get('sort');
  const sortDesc = searchParams.get('desc') !== 'false';
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const requestedOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
  const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;

  let query = supabase
    .from('professional_players')
    .select('*, professional_teams(name, logo_url)', { count: 'exact' });

  const showAll = searchParams.get('show_all') === 'true' || Boolean(search && search.trim().length > 0);
  if (!showAll) query = query.eq('availability_status', 'available');
  if (rosteredOnly) query = query.not('team_id', 'is', null);
  if (teamId) query = query.eq('team_id', Number.parseInt(teamId, 10));

  if (role) {
    if (role === 'Hard Support' || role === 'Support') {
      query = query.in('primary_role', ['Hard Support', 'Support']);
    } else {
      query = query.eq('primary_role', role);
    }
  }

  const idsParam = searchParams.get('ids');
  if (idsParam) {
    const ids = idsParam.split(',').map((id) => Number.parseInt(id.trim(), 10)).filter(Number.isFinite);
    if (ids.length > 0) query = query.in('id', ids);
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
  if (error) throw new PlayersCatalogError('Failed to fetch players', error.message);

  const playerRows = data ?? [];
  const playerIds = playerRows.map((player) => player.id);
  const [
    { data: prices, error: pricesError },
    { data: scores, error: scoresError },
  ] = await Promise.all([
    playerIds.length > 0
      ? (supabase.from('player_prices') as unknown as DynamicPlayerQuery<{ data: PriceRow[] | null; error: { message: string } | null }>)
          .select('player_id, price, price_change, ownership_percentage, gameweek_id')
          .in('player_id', playerIds)
          .order('gameweek_id', { ascending: false })
          .limit(playerIds.length * 7)
      : Promise.resolve({ data: [], error: null }),
    playerIds.length > 0
      ? (supabase.from('gameweek_scores') as unknown as DynamicPlayerQuery<{ data: ScoreRow[] | null; error: { message: string } | null }>)
          .select('player_id, total_points, gameweek_id')
          .in('player_id', playerIds)
          .order('gameweek_id', { ascending: false })
          .limit(playerIds.length * 5)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (pricesError || scoresError) {
    throw new PlayersCatalogError(
      'Failed to fetch player comparison data',
      pricesError?.message ?? scoresError?.message ?? 'Unknown database error',
    );
  }

  const latestPrices = new Map<number, number>();
  const latestPriceChanges = new Map<number, number | null>();
  const latestOwnerships = new Map<number, number | null>();
  const priceHistoryByPlayer = new Map<number, number[]>();
  for (const price of prices ?? []) {
    if (!latestPrices.has(price.player_id)) {
      latestPrices.set(price.player_id, Number(price.price ?? 0));
      latestPriceChanges.set(price.player_id, price.price_change == null ? null : Number(price.price_change));
      latestOwnerships.set(
        price.player_id,
        price.ownership_percentage == null ? null : Number(price.ownership_percentage),
      );
    }
    const history = priceHistoryByPlayer.get(price.player_id) ?? [];
    if (history.length < 7 && price.price != null) {
      history.push(Number(price.price));
      priceHistoryByPlayer.set(price.player_id, history);
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
    const rawHistory = priceHistoryByPlayer.get(player.id);
    const currentPrice = latestPrices.get(player.id) ?? (
      player.current_price == null ? null : Number(player.current_price)
    );
    const priceHistory = rawHistory?.length
      ? [...rawHistory].reverse()
      : (currentPrice !== null ? [currentPrice] : []);

    return {
      ...player,
      current_price: currentPrice,
      price_change: latestPriceChanges.get(player.id) ?? null,
      price_history: priceHistory,
      ownership_percentage: latestOwnerships.get(player.id) ?? null,
      gameweek_points: playerScores[0] ?? 0,
      recent_points: playerScores.length
        ? Number((playerScores.reduce((sum, score) => sum + score, 0) / playerScores.length).toFixed(2))
        : 0,
    };
  });

  return { data: enrichedData, total: count, limit, offset };
}
