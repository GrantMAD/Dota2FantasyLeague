import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const playerId = parseInt(params.id, 10);
    if (isNaN(playerId)) {
      return NextResponse.json({ error: 'Invalid player ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // 1. Fetch player and professional team details
    const { data: player, error: playerError } = await (supabase
      .from('professional_players') as any)
      .select('*, professional_teams(id, name, slug, region, logo_url)')
      .eq('id', playerId)
      .maybeSingle();

    if (playerError) {
      return NextResponse.json({ error: 'Failed to fetch player.', details: playerError.message }, { status: 500 });
    }

    if (!player) {
      return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
    }

    // 2. Fetch prices, scores, and performances in parallel
    const [{ data: prices }, { data: scores }, { data: performances }] = await Promise.all([
      (supabase.from('player_prices') as any)
        .select('gameweek_id, price, price_change, ownership_percentage, created_at')
        .eq('player_id', playerId)
        .order('gameweek_id', { ascending: false }),
      (supabase.from('gameweek_scores') as any)
        .select('gameweek_id, total_points, captain_multiplier, points_with_multiplier')
        .eq('player_id', playerId)
        .order('gameweek_id', { ascending: false }),
      (supabase.from('player_performances') as any)
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

    const latestPrice = prices?.[0]?.price ?? 0;
    const latestOwnership = prices?.[0]?.ownership_percentage ?? 0;
    const totalSeasonPoints = (scores ?? []).reduce((sum: number, s: any) => sum + Number(s.total_points ?? 0), 0);
    const lastGwPoints = scores?.[0]?.total_points ?? 0;

    return NextResponse.json({
      player: {
        ...player,
        real_name: player.name,
        current_price: Number(latestPrice),
        ownership_percentage: Number(latestOwnership),
        total_season_points: Number(totalSeasonPoints.toFixed(1)),
        last_gw_points: Number(lastGwPoints),
        prices: prices ?? [],
        scores: scores ?? [],
        performances: performances ?? [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
