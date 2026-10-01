import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface PlayerPriceRow {
  gameweek_id: number;
  price: number | null;
  price_change: number | null;
  ownership_percentage: number | null;
  created_at: string;
}

interface PerformanceSumRow {
  fantasy_points_breakdown: { total_points: number | null } | null;
  gameweek_id: number;
}

type PlayerPerformanceRow = Record<string, unknown>;

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const playerId = parseInt(params.id, 10);
    if (isNaN(playerId)) {
      return NextResponse.json({ error: 'Invalid player ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // 1. Fetch player and professional team details
    const { data: player, error: playerError } = await supabase
      .from('professional_players')
      .select('*, professional_teams(id, name, slug, region, logo_url)')
      .eq('id', playerId)
      .maybeSingle();

    if (playerError) {
      return NextResponse.json({ error: 'Failed to fetch player.', details: playerError.message }, { status: 500 });
    }

    if (!player) {
      return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
    }

    // 2. Fetch prices, all performances (for season total), and recent performances (for display) in parallel
    const [{ data: prices }, { data: allPerformanceSums }, { data: performances }] = await Promise.all([
      supabase.from('player_prices')
        .select('gameweek_id, price, price_change, ownership_percentage, created_at')
        .eq('player_id', playerId)
        .order('gameweek_id', { ascending: false }),
      // Fetch all performances to sum season total points
      supabase.from('player_performances')
        .select('gameweek_id, fantasy_points_breakdown(total_points)')
        .eq('player_id', playerId)
        .order('gameweek_id', { ascending: false }),
      // Fetch last 15 performances with full stats for display
      supabase.from('player_performances')
        .select(`
          id,
          gameweek_id,
          kills,
          deaths,
          assists,
          gold_per_minute,
          experience_per_minute,
          last_hits,
          denies,
          hero_damage,
          building_damage,
          healing,
          tower_participation,
          roshan_participation,
          wards_placed,
          wards_destroyed,
          matches (
            id,
            match_number,
            duration_minutes,
            winner_team_id,
            team_a:team_a_id (id, name, slug),
            team_b:team_b_id (id, name, slug)
          ),
          fantasy_points_breakdown (
            combat_points,
            economy_points,
            objective_points,
            teamfight_points,
            win_points,
            series_points,
            performance_index_points,
            consistency_points,
            penalty_points,
            total_points
          )
        `)
        .eq('player_id', playerId)
        .order('gameweek_id', { ascending: false })
        .limit(15),
    ]);

    const priceRows = (prices ?? []) as unknown as PlayerPriceRow[];
    const allSumRows = (allPerformanceSums ?? []) as unknown as PerformanceSumRow[];
    const performanceRows = (performances ?? []) as unknown as PlayerPerformanceRow[];
    const latestPrice = priceRows[0]?.price ?? 0;
    const latestOwnership = priceRows[0]?.ownership_percentage ?? 0;

    // Sum all season points from fantasy_points_breakdown across all performances
    const totalSeasonPoints = allSumRows.reduce((sum, row) => {
      const pts = Number((row.fantasy_points_breakdown as { total_points: number | null } | null)?.total_points ?? 0);
      return sum + pts;
    }, 0);

    // Last gameweek points: sum of all performances in the most recent gameweek
    const latestGwId = allSumRows[0]?.gameweek_id ?? null;
    const lastGwPoints = latestGwId
      ? allSumRows
          .filter((r) => r.gameweek_id === latestGwId)
          .reduce((sum, r) => sum + Number((r.fantasy_points_breakdown as { total_points: number | null } | null)?.total_points ?? 0), 0)
      : 0;

    return NextResponse.json({
      player: {
        ...player,
        real_name: player.name,
        current_price: Number(latestPrice),
        ownership_percentage: Number(latestOwnership),
        total_season_points: Number(totalSeasonPoints.toFixed(1)),
        last_gw_points: Number(lastGwPoints),
        prices: priceRows,
        performances: performanceRows,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
