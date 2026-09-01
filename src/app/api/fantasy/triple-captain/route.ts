import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, AuthError } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
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

    // 4. Handle RPC custom response
    if (data && (data as any).success === false) {
      return NextResponse.json(
        { error: (data as any).message || 'Triple Captain activation failed.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: (data as any).message || 'Triple Captain activated successfully.',
      gameweekId: (data as any).gameweek_id,
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
