import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, AuthError } from '@/lib/auth-utils';
import { logAuditAction } from '@/lib/audit-logger';
import { withApiTelemetry } from '@/lib/api-telemetry';


interface ChipActivationResult {
  success?: boolean;
  message?: string;
  gameweek_id?: number | null;
}

async function postHandler(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await verifyAuth(request);

    // 2. Parse payload
    const body = await request.json();
    const { fantasySeasonId } = body;

    if (!fantasySeasonId || typeof fantasySeasonId !== 'number') {
      return NextResponse.json(
        { error: 'Invalid or missing fantasySeasonId.' },
        { status: 400 }
      );
    }

    // 3. Call the Postgres RPC to activate the triple captain chip
    const supabase = supabaseServer();
    const { data, error } = await supabase.rpc('activate_triple_captain', {
      p_user_id: userId,
      p_fantasy_season_id: fantasySeasonId,
    });

    if (error) {
      console.error('Supabase RPC Error (activate_triple_captain):', error);
      return NextResponse.json(
        { error: 'Database error occurred while activating Triple Captain.', details: error.message },
        { status: 500 }
      );
    }

    const result = data as ChipActivationResult | null;

    // 4. Handle RPC custom response
    if (result?.success === false) {
      return NextResponse.json(
        { error: result.message || 'Triple Captain activation failed.' },
        { status: 400 }
      );
    }

    await logAuditAction({
      tableName: 'fantasy_seasons',
      recordId: fantasySeasonId,
      action: 'CHIP_ACTIVATED',
      changedBy: userId,
      newValues: { chip: 'triple_captain', gameweek_id: result?.gameweek_id },
      reason: 'User activated Triple Captain chip',
    });

    return NextResponse.json({
      message: result?.message || 'Triple Captain activated successfully.',
      gameweekId: result?.gameweek_id,
    });
  } catch (error: unknown) {
    console.error('Triple Captain API Error:', error);

    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred while activating the Triple Captain chip.' },
      { status: 500 }
    );
  }
}

export const POST = withApiTelemetry('POST', '/api/fantasy/triple-captain', postHandler);
