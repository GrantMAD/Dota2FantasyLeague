import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';


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

interface PlayerPointTotals {
  total_season_points: number | string;
  last_gw_points: number | string;
}

type PlayerPerformanceRow = Record<string, unknown>;

async function getHandler(request: NextRequest, context: RouteContext) {
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

    // 2. Fetch prices, aggregate point totals, and recent performances in parallel
    const [
      { data: prices, error: pricesError },
      { data: pointTotalsResult, error: pointTotalsError },
      { data: performances, error: performancesError },
    ] = await Promise.all([
      supabase.from('player_prices')
        .select('gameweek_id, price, price_change, ownership_percentage, created_at')
        .eq('player_id', playerId)
        .order('gameweek_id', { ascending: false }),
      supabase.rpc('get_player_detail_point_totals', { p_player_id: playerId }),
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

    if (pricesError) {
      return NextResponse.json(
        { error: 'Failed to fetch player prices.', details: pricesError.message },
        { status: 500 }
      );
    }
    if (pointTotalsError) {
      return NextResponse.json(
        { error: 'Failed to calculate player points.', details: pointTotalsError.message },
        { status: 500 }
      );
    }
    if (performancesError) {
      return NextResponse.json(
        { error: 'Failed to fetch player performances.', details: performancesError.message },
        { status: 500 }
      );
    }

    const priceRows = (prices ?? []) as unknown as PlayerPriceRow[];
    const performanceRows = (performances ?? []) as unknown as PlayerPerformanceRow[];
    const pointTotals = Array.isArray(pointTotalsResult)
      ? pointTotalsResult[0] as PlayerPointTotals | undefined
      : pointTotalsResult as PlayerPointTotals | null;
    if (!pointTotals) {
      return NextResponse.json(
        { error: 'Player point totals were not returned.' },
        { status: 500 }
      );
    }

    const totalSeasonPoints = Number(pointTotals.total_season_points);
    const lastGwPoints = Number(pointTotals.last_gw_points);
    if (!Number.isFinite(totalSeasonPoints) || !Number.isFinite(lastGwPoints)) {
      return NextResponse.json(
        { error: 'Player point totals were returned in an invalid format.' },
        { status: 500 }
      );
    }

    const latestPrice = priceRows[0]?.price ?? 0;
    const latestOwnership = priceRows[0]?.ownership_percentage ?? 0;

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

export const GET = withApiTelemetry('GET', '/api/players/:id', getHandler);
