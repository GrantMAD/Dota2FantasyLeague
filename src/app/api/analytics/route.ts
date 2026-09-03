import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request);
    const supabase = supabaseServer();

    const [{ count: totalUsers }, { count: activeUsers }, { count: premiumUsers }, { data: avgScoreData }] = await Promise.all([
      (supabase.from('users') as any).select('*', { count: 'exact' }),
      (supabase.from('users') as any).select('*', { count: 'exact' }).gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      (supabase.from('users') as any).select('*', { count: 'exact' }).eq('theme_preference', 'dark'),
      (supabase.from('fantasy_seasons') as any).select('total_points').gte('total_points', 0),
    ]);

    const totalScore = (avgScoreData ?? []).reduce((sum: number, row: any) => sum + Number(row.total_points || 0), 0);
    const totalFantasyUsers = (avgScoreData ?? []).length || 0;
    const avgFantasyScore = totalFantasyUsers ? Number((totalScore / totalFantasyUsers).toFixed(1)) : 0;
    const conversionRate = totalUsers ? Number(((premiumUsers ?? 0) / totalUsers * 100).toFixed(1)) : 0;

    return NextResponse.json({
      totalUsers: totalUsers ?? 0,
      activeUsers: activeUsers ?? 0,
      avgFantasyScore,
      premiumUsers: premiumUsers ?? 0,
      conversionRate,
      premiumRatio: totalUsers ? Number((((premiumUsers ?? 0) * 100) / totalUsers).toFixed(2)) : 0,
    });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 401;
    return NextResponse.json({ error: 'Unable to load analytics.' }, { status });
  }
}
