import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const supabase = supabaseServer();
    const { data: fantasySeason, error: seasonError } = await (supabase.from('fantasy_seasons') as any)
      .select('id, budget, free_transfers, wildcard_used_gameweek_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (seasonError) return NextResponse.json({ error: 'Failed to load transfer context.' }, { status: 500 });
    if (!fantasySeason) return NextResponse.json({ fantasySeasonId: null, budget: 0, freeTransfers: 0, wildcardUsed: false, ownedPlayerIds: [] });

    const { data: squad, error: squadError } = await (supabase.from('fantasy_squads') as any)
      .select('id, fantasy_squad_members(player_id, removed_date)')
      .eq('fantasy_season_id', fantasySeason.id)
      .limit(1)
      .maybeSingle();
    if (squadError) return NextResponse.json({ error: 'Failed to load squad transfer context.' }, { status: 500 });

    const ownedPlayerIds = (squad?.fantasy_squad_members ?? [])
      .filter((member: { removed_date: string | null }) => !member.removed_date)
      .map((member: { player_id: number }) => member.player_id);

    return NextResponse.json({
      fantasySeasonId: fantasySeason.id,
      budget: Number(fantasySeason.budget ?? 0),
      freeTransfers: Number(fantasySeason.free_transfers ?? 1),
      wildcardUsed: fantasySeason.wildcard_used_gameweek_id !== null,
      wildcardUsedGameweekId: fantasySeason.wildcard_used_gameweek_id,
      ownedPlayerIds,
    });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load transfer context.' }, { status });
  }
}
