import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth-utils';
import { buildRoleBalanceReport, type ScoringSample } from '@/lib/scoring-analytics';
import { supabaseServer } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    await verifyAdminAuth(request);
    const seasonId = Number(request.nextUrl.searchParams.get('seasonId') ?? 1);
    const gameweekId = request.nextUrl.searchParams.get('gameweekId');
    const supabase = supabaseServer();

    let performanceQuery = (supabase.from('player_performances') as any)
      .select('id, player_id, gameweek_id')
      .limit(1000);
    if (gameweekId) performanceQuery = performanceQuery.eq('gameweek_id', Number(gameweekId));

    const [{ data: performances, error: performanceError }, { data: players, error: playerError }, { data: breakdowns, error: breakdownError }, { data: prices, error: priceError }] = await Promise.all([
      performanceQuery,
      (supabase.from('professional_players') as any).select('id, primary_role'),
      (supabase.from('fantasy_points_breakdown') as any).select('performance_id, total_points'),
      (supabase.from('player_prices') as any).select('player_id, price, ownership_percentage').eq('season_id', seasonId).order('gameweek_id', { ascending: false }),
    ]);

    const errors = [performanceError, playerError, breakdownError, priceError].filter(Boolean);
    if (errors.length > 0) return NextResponse.json({ error: 'Failed to load scoring balance data.' }, { status: 500 });

    const playerMap = new Map((players ?? []).map((player: { id: number; primary_role: string }) => [player.id, player.primary_role]));
    const breakdownMap = new Map((breakdowns ?? []).map((breakdown: { performance_id: number; total_points: number }) => [breakdown.performance_id, Number(breakdown.total_points ?? 0)]));
    const priceMap = new Map<number, { price: number; ownership: number }>();
    for (const price of prices ?? []) {
      if (!priceMap.has(price.player_id)) priceMap.set(price.player_id, { price: Number(price.price ?? 0), ownership: Number(price.ownership_percentage ?? 0) });
    }

    const samples: ScoringSample[] = (performances ?? []).map((performance: { id: number; player_id: number; gameweek_id: number }) => {
      const market = priceMap.get(performance.player_id) ?? { price: 0, ownership: 0 };
      return {
        role: playerMap.get(performance.player_id) ?? 'Support',
        playerId: performance.player_id,
        totalPoints: breakdownMap.get(performance.id) ?? 0,
        price: market.price,
        ownershipPercentage: market.ownership,
        captainPoints: 0,
        gameweekId: performance.gameweek_id,
      };
    });

    return NextResponse.json({ seasonId, gameweekId: gameweekId ? Number(gameweekId) : null, sampleSize: samples.length, report: buildRoleBalanceReport(samples) });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load scoring balance data.' }, { status });
  }
}
