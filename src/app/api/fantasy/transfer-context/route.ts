import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { getOrCreateFantasySeason } from '@/lib/fantasy-season';
import { withApiTelemetry } from '@/lib/api-telemetry';


async function getHandler(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const supabase = supabaseServer();
    const fantasySeason = await getOrCreateFantasySeason(supabase, userId);

    if (!fantasySeason || !fantasySeason.id) {
      return NextResponse.json({
        fantasySeasonId: null,
        budget: 100,
        freeTransfers: 2,
        wildcardUsed: false,
        ownedPlayerIds: [],
      });
    }

    // Try to get wildcard status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: wildcardData, error: wildcardError } = await (supabase.from('fantasy_seasons') as any)
      .select('wildcard_used_gameweek_id')
      .eq('id', fantasySeason.id)
      .maybeSingle();
    if (wildcardError) {
      console.error('[Transfer context] Failed to load Wildcard status:', wildcardError.message);
      return NextResponse.json({ error: 'Failed to load Wildcard status.' }, { status: 500 });
    }

    const wildcardUsedGameweekId = wildcardData?.wildcard_used_gameweek_id ?? null;
    let wildcardUsedGameweekNumber: number | null = null;
    if (wildcardUsedGameweekId !== null) {
      const { data: wildcardGameweek, error: wildcardGameweekError } = await supabase
        .from('gameweeks')
        .select('gameweek_number')
        .eq('id', wildcardUsedGameweekId)
        .maybeSingle();
      if (wildcardGameweekError) {
        console.error('[Transfer context] Failed to load Wildcard gameweek:', wildcardGameweekError.message);
        return NextResponse.json({ error: 'Failed to load Wildcard usage details.' }, { status: 500 });
      }
      wildcardUsedGameweekNumber = wildcardGameweek?.gameweek_number ?? null;
    }

    const { data: squadData, error: squadError } = await supabase.from('fantasy_squads')
      .select('id, fantasy_squad_members(player_id, removed_date)')
      .eq('fantasy_season_id', fantasySeason.id)
      .limit(1)
      .maybeSingle();
    const squad = squadData as {
      fantasy_squad_members: { player_id: number; removed_date: string | null }[];
    } | null;
    if (squadError) return NextResponse.json({ error: 'Failed to load squad transfer context.' }, { status: 500 });

    const ownedPlayerIds = (squad?.fantasy_squad_members ?? [])
      .filter((member: { removed_date: string | null }) => !member.removed_date)
      .map((member: { player_id: number }) => member.player_id);

    return NextResponse.json({
      fantasySeasonId: fantasySeason.id,
      budget: Number(fantasySeason.budget ?? 100),
      freeTransfers: Number(fantasySeason.free_transfers ?? 2),
      wildcardUsed: wildcardUsedGameweekId !== null,
      wildcardUsedGameweekId,
      wildcardUsedGameweekNumber,
      ownedPlayerIds,
    });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load transfer context.' }, { status });
  }
}

export const GET = withApiTelemetry('GET', '/api/fantasy/transfer-context', getHandler);
