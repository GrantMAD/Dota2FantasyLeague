import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, AuthError } from '@/lib/auth-utils';
import { withApiTelemetry } from '@/lib/api-telemetry';

async function postHandler(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);

    const body = (await request.json()) as { fantasySeasonId?: unknown; playerIds?: unknown };
    const { fantasySeasonId, playerIds } = body;

    if (!fantasySeasonId || typeof fantasySeasonId !== 'number') {
      return NextResponse.json({ error: 'Invalid or missing fantasySeasonId.' }, { status: 400 });
    }
    if (
      !Array.isArray(playerIds) ||
      playerIds.length === 0 ||
      !playerIds.every((id): id is number => typeof id === 'number' && Number.isInteger(id))
    ) {
      return NextResponse.json({ error: 'playerIds must be a non-empty array of integer IDs.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Delegate all business logic (ownership check, squad creation, availability,
    // duplicate detection, squad-size limit, 3-per-team cap, role-composition
    // validation, budget check, insert, and budget deduction) to a single
    // PostgreSQL transaction via RPC.  This prevents partial-write races where
    // the insert could succeed while the budget update fails, and closes the
    // concurrent double-spend window present in the previous multi-query approach.
    const { data, error } = await supabase.rpc('process_initial_squad_draft', {
      p_user_id: userId,
      p_fantasy_season_id: fantasySeasonId,
      p_player_ids: playerIds,
    });

    if (error) {
      console.error('Supabase RPC Error (process_initial_squad_draft):', error);
      return NextResponse.json({ error: 'Failed to process squad draft.' }, { status: 500 });
    }

    // RPC returns success:false for any business-rule violation
    if (data && data.success === false) {
      return NextResponse.json(
        { error: data.message || 'Squad draft failed validation.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: `${playerIds.length} player${playerIds.length > 1 ? 's' : ''} added to squad.`,
      budget: data.budget,
      squadSize: data.squad_size,
      squadMaxSize: data.squad_max_size,
    });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export const POST = withApiTelemetry('POST', '/api/fantasy/squad/add', postHandler);
