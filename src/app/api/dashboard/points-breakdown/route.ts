import { NextRequest, NextResponse } from 'next/server';
import { applyRefreshedTokens, AuthError, verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import {
  buildGameweekPointsBreakdown,
  POINT_CATEGORIES,
  sumGameweekPointCategories,
  type PlayerPointCategories,
  type PointsLineup,
  type PointsPerformance,
  type PointsPlayer,
} from '@/lib/dashboard-points';

interface BreakdownRecord {
  combat_points: number | null;
  economy_points: number | null;
  objective_points: number | null;
  teamfight_points: number | null;
  win_points: number | null;
  series_points: number | null;
  performance_index_points: number | null;
  consistency_points: number | null;
  penalty_points: number | null;
}

interface PerformanceRecord {
  gameweek_id: number;
  player_id: number;
  fantasy_points_breakdown: BreakdownRecord | BreakdownRecord[] | null;
}

const toCategories = (record: BreakdownRecord | null): PlayerPointCategories => ({
  combat: Number(record?.combat_points ?? 0),
  economy: Number(record?.economy_points ?? 0),
  objective: Number(record?.objective_points ?? 0),
  teamfight: Number(record?.teamfight_points ?? 0),
  win: Number(record?.win_points ?? 0),
  series: Number(record?.series_points ?? 0),
  performance: Number(record?.performance_index_points ?? 0),
  consistency: Number(record?.consistency_points ?? 0),
  penalty: -Number(record?.penalty_points ?? 0),
});

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const supabase = supabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fantasySeason, error: seasonError } = await (supabase.from('fantasy_seasons') as any)
      .select('id, season_id, total_points, triple_captain_gameweek_id, bench_boost_gameweek_id')
      .eq('user_id', user.userId)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (seasonError) throw new Error(`Failed to load your fantasy season: ${seasonError.message}`);
    if (!fantasySeason) {
      const response = NextResponse.json({
        totalPoints: 0,
        categoryTotals: toCategories(null),
        unitemizedPoints: 0,
        gameweeks: [],
      });
      applyRefreshedTokens(response, user);
      return response;
    }

    const [
      lineupsResult,
      seasonNameResult,
    ] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('fantasy_lineups') as any)
        .select('id, gameweek_id, total_points, carry_id, mid_id, offlane_id, support_id, hard_support_id, bench_1_id, bench_2_id, bench_3_id, captain_player_id, vice_captain_player_id')
        .eq('fantasy_season_id', fantasySeason.id)
        .order('gameweek_id', { ascending: true }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('seasons') as any)
        .select('name')
        .eq('id', fantasySeason.season_id)
        .maybeSingle(),
    ]);
    if (lineupsResult.error) throw new Error(`Failed to load your gameweek scores: ${lineupsResult.error.message}`);
    if (seasonNameResult.error) throw new Error(`Failed to load the season name: ${seasonNameResult.error.message}`);

    const lineups = (lineupsResult.data ?? []) as PointsLineup[];
    const gameweekIds = [...new Set(lineups.map((lineup) => lineup.gameweek_id))];
    const playerIds = [...new Set(lineups.flatMap((lineup) => [
      lineup.carry_id,
      lineup.mid_id,
      lineup.offlane_id,
      lineup.support_id,
      lineup.hard_support_id,
      lineup.bench_1_id,
      lineup.bench_2_id,
      lineup.bench_3_id,
    ].filter((playerId): playerId is number => playerId !== null)))];

    const [gameweeksResult, playersResult, performancesResult] = gameweekIds.length > 0
      ? await Promise.all([
        supabase.from('gameweeks').select('id, gameweek_number').in('id', gameweekIds),
        playerIds.length > 0
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (supabase.from('professional_players') as any)
            .select('id, name, in_game_name, primary_role')
            .in('id', playerIds)
          : Promise.resolve({ data: [], error: null }),
        playerIds.length > 0
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (supabase.from('player_performances') as any)
            .select('gameweek_id, player_id, fantasy_points_breakdown(combat_points, economy_points, objective_points, teamfight_points, win_points, series_points, performance_index_points, consistency_points, penalty_points)')
            .in('gameweek_id', gameweekIds)
            .in('player_id', playerIds)
          : Promise.resolve({ data: [], error: null }),
      ])
      : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

    if (gameweeksResult.error) throw new Error(`Failed to load gameweek names: ${gameweeksResult.error.message}`);
    if (playersResult.error) throw new Error(`Failed to load player names: ${playersResult.error.message}`);
    if (performancesResult.error) throw new Error(`Failed to load player scoring details: ${performancesResult.error.message}`);

    const gameweekNumbers = new Map(
      (gameweeksResult.data ?? []).map((gameweek) => [gameweek.id, gameweek.gameweek_number]),
    );
    const performances = ((performancesResult.data ?? []) as PerformanceRecord[]).map((row): PointsPerformance => {
      const breakdown = Array.isArray(row.fantasy_points_breakdown)
        ? row.fantasy_points_breakdown[0] ?? null
        : row.fantasy_points_breakdown;
      return {
        gameweek_id: row.gameweek_id,
        player_id: row.player_id,
        categories: toCategories(breakdown),
      };
    });
    const gameweeks = buildGameweekPointsBreakdown({
      lineups,
      performances,
      players: (playersResult.data ?? []) as PointsPlayer[],
      gameweekNumbers,
      tripleCaptainGameweekId: fantasySeason.triple_captain_gameweek_id ?? null,
      benchBoostGameweekId: fantasySeason.bench_boost_gameweek_id ?? null,
    });
    const categoryTotals = sumGameweekPointCategories(gameweeks);
    const totalPoints = Number(fantasySeason.total_points ?? 0);
    const categorizedTotal = POINT_CATEGORIES.reduce(
      (sum, [category]) => sum + categoryTotals[category],
      0,
    );
    const response = NextResponse.json({
      seasonName: seasonNameResult.data?.name ?? null,
      totalPoints,
      categoryTotals,
      unitemizedPoints: Math.round((totalPoints - categorizedTotal) * 100) / 100,
      gameweeks,
    });
    applyRefreshedTokens(response, user);
    return response;
  } catch (error) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    console.error('Dashboard points breakdown failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load your points breakdown.' },
      { status: 500 },
    );
  }
}
