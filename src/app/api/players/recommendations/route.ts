import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { canUsePremiumFeature } from '@/lib/premium';
import { supabaseServer } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const supabase = supabaseServer();
    const { data: profile } = await (supabase.from('profiles') as any).select('is_premium, subscription_tier').eq('id', auth.userId).maybeSingle(); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!canUsePremiumFeature(profile, 'ai-recommendations')) return NextResponse.json({ error: 'AI transfer recommendations require a premium account.' }, { status: 403 });
    const { data: players, error } = await (supabase.from('professional_players') as any).select('id, name, primary_role, current_price, availability_status').eq('availability_status', 'available').order('current_price', { ascending: false }).limit(10); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (error) return NextResponse.json({ error: 'Failed to load transfer recommendations.' }, { status: 500 });
    return NextResponse.json({ recommendations: (players ?? []).map((player: { id: number; name: string; primary_role: string; current_price: number; availability_status: string }, index: number) => ({ ...player, reason: index < 3 ? 'High current market value candidate' : 'Available squad option', confidence: Math.max(0.5, Number((0.9 - index * 0.04).toFixed(2))) })) });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load recommendations.' }, { status });
  }
}
