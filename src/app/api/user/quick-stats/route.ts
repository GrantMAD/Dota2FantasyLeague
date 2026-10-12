import { NextRequest, NextResponse } from 'next/server';
import { applyRefreshedTokens, verifyAuth } from '@/lib/auth-utils';
import { withApiTelemetry } from '@/lib/api-telemetry';
import { getOrCreateFantasySeason } from '@/lib/fantasy-season';
import { supabaseServer } from '@/lib/supabase';

async function getHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const supabase = supabaseServer();
    const [fantasySeason, gameweeksRes] = await Promise.all([
      getOrCreateFantasySeason(supabase, user.userId),
      supabase
        .from('gameweeks')
        .select('id, gameweek_number, deadline, status')
        .in('status', ['upcoming', 'active'])
        .order('start_date', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (gameweeksRes.error) {
      throw new Error(`Failed to load current gameweek: ${gameweeksRes.error.message}`);
    }

    let gameweek = gameweeksRes.data;
    if (!gameweek) {
      const closedGameweeksRes = await supabase
        .from('gameweeks')
        .select('id, gameweek_number, deadline, status')
        .eq('status', 'closed')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (closedGameweeksRes.error) {
        throw new Error(`Failed to load the latest closed gameweek: ${closedGameweeksRes.error.message}`);
      }
      gameweek = closedGameweeksRes.data;
    }

    const response = NextResponse.json({
      bankBalance: Number(fantasySeason?.budget ?? 100),
      freeTransfers: Number(fantasySeason?.free_transfers ?? 2),
      globalRank: fantasySeason?.global_rank ?? null,
      totalPoints: Number(fantasySeason?.total_points ?? 0),
      gameweek,
    });
    applyRefreshedTokens(response, user);
    return response;
  } catch (error: unknown) {
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status: number }).status)
        : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load quick stats.' },
      { status },
    );
  }
}

export const GET = withApiTelemetry('GET', '/api/user/quick-stats', getHandler);
