import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { canUsePremiumFeature } from '@/lib/premium';
import { buildPlayerAnalytics } from '@/lib/player-analytics';
import { supabaseServer } from '@/lib/supabase';

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await verifyAuth(request);
    const { id } = await context.params;
    const supabase = supabaseServer();
    const { data: profile } = await (supabase.from('profiles') as any).select('is_premium, subscription_tier').eq('id', auth.userId).maybeSingle(); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!canUsePremiumFeature(profile, 'advanced-analytics')) {
      return NextResponse.json({ error: 'Advanced analytics require a premium account.' }, { status: 403 });
    }
    const { data: performances, error } = await (supabase.from('player_performances') as any).select('id, gameweek_id').eq('player_id', Number(id)).order('gameweek_id', { ascending: true }).limit(50); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (error) return NextResponse.json({ error: 'Failed to load player analytics.' }, { status: 500 });
    const { data: breakdowns } = await (supabase.from('fantasy_points_breakdown') as any).select('performance_id, total_points'); // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data: prices } = await (supabase.from('player_prices') as any).select('gameweek_id, price').eq('player_id', Number(id)).order('gameweek_id', { ascending: true }).limit(50); // eslint-disable-line @typescript-eslint/no-explicit-any
    const breakdownMap = new Map((breakdowns ?? []).map((row: { performance_id: number; total_points: number }) => [row.performance_id, Number(row.total_points ?? 0)]));
    const priceRows = prices ?? [];
    const samples = (performances ?? []).map((performance: { id: number; gameweek_id: number }, index: number) => ({ gameweekId: performance.gameweek_id, points: breakdownMap.get(performance.id) ?? 0, price: Number(priceRows[index]?.price ?? 0) }));
    return NextResponse.json({ playerId: Number(id), analytics: buildPlayerAnalytics(samples) });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load player analytics.' }, { status });
  }
}
