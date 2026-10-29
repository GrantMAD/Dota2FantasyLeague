import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { canUsePremiumFeature } from '@/lib/premium';
import { buildPlayerAnalytics } from '@/lib/player-analytics';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';


interface RouteContext { params: Promise<{ id: string }> }

interface PlayerPerformanceSample {
  id: number;
  gameweek_id: number;
}

interface PlayerPriceSample {
  gameweek_id: number;
  price: number | null;
}

async function getHandler(request: NextRequest, context: RouteContext) {
  try {
    const auth = await verifyAuth(request);
    const { id } = await context.params;
    const supabase = supabaseServer();
    const { data: profile } = await (supabase.from('users') as any).select('is_premium, subscription_tier').eq('id', auth.userId).maybeSingle(); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!canUsePremiumFeature(profile, 'advanced-analytics')) {
      return NextResponse.json({ error: 'Advanced analytics require a premium account.' }, { status: 403 });
    }

    const { data: performances, error } = await (supabase.from('player_performances') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .select('id, gameweek_id')
      .eq('player_id', Number(id))
      .order('gameweek_id', { ascending: true })
      .order('id', { ascending: true })
      .limit(50);
    if (error) return NextResponse.json({ error: 'Failed to load player analytics.' }, { status: 500 });

    // Finding 2 fix: filter breakdown query by the player's scoped performance IDs
    // instead of scanning the entire fantasy_points_breakdown table globally.
    const performanceIds = (performances ?? []).map((p: { id: number }) => p.id);
    let breakdownMap = new Map<number, number>();
    if (performanceIds.length > 0) {
      const { data: breakdowns, error: breakdownError } = await (supabase.from('fantasy_points_breakdown') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select('performance_id, total_points')
        .in('performance_id', performanceIds);
      if (breakdownError) return NextResponse.json({ error: 'Failed to load player analytics.' }, { status: 500 });
      breakdownMap = new Map((breakdowns ?? []).map((row: { performance_id: number; total_points: number }) => [row.performance_id, Number(row.total_points ?? 0)]));
    }

    const { data: prices, error: pricesError } = await (supabase.from('player_prices') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .select('gameweek_id, price')
      .eq('player_id', Number(id))
      .order('gameweek_id', { ascending: true })
      .limit(50);
    if (pricesError) return NextResponse.json({ error: 'Failed to load player analytics.' }, { status: 500 });

    const priceByGameweek = new Map<number, number | null>(
      ((prices ?? []) as PlayerPriceSample[]).map((row) => [
        row.gameweek_id,
        row.price === null ? null : Number(row.price),
      ])
    );
    const samples = ((performances ?? []) as PlayerPerformanceSample[]).map((performance) => ({
      gameweekId: performance.gameweek_id,
      points: breakdownMap.get(performance.id) ?? 0,
      price: priceByGameweek.get(performance.gameweek_id) ?? null,
    }));

    // Optional role lookup wrapped in try/catch to ensure backwards compatibility with tests and isolated DB mocks
    let role: string | null = null;
    try {
      const { data: playerInfo } = await (supabase.from('professional_players') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select('primary_role')
        .eq('id', Number(id))
        .maybeSingle();
      role = playerInfo?.primary_role ?? null;
    } catch {
      // Mock environments or missing tables fall back gracefully
    }

    return NextResponse.json({
      playerId: Number(id),
      analytics: buildPlayerAnalytics(samples, { role }),
    });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load player analytics.' }, { status });
  }
}

export const GET = withApiTelemetry('GET', '/api/players/:id/analytics', getHandler);
