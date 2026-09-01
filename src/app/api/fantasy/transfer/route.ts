import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, AuthError } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await verifyAuth(request);

    // 2. Parse payload
    const body = await request.json();
    const { fantasySeasonId, transfersIn, transfersOut } = body;

    if (!fantasySeasonId || typeof fantasySeasonId !== 'number') {
      return NextResponse.json(
        { error: 'Invalid or missing fantasySeasonId.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(transfersIn) || !Array.isArray(transfersOut)) {
      return NextResponse.json(
        { error: 'transfersIn and transfersOut must be arrays.' },
        { status: 400 }
      );
    }

    if (transfersIn.length !== transfersOut.length) {
      return NextResponse.json(
        { error: 'Number of players to transfer in and out must be equal.' },
        { status: 400 }
      );
    }

    if (transfersIn.length === 0) {
      return NextResponse.json(
        { message: 'No transfers requested.' },
        { status: 200 }
      );
    }

    // 3. Call the Postgres RPC function
    const supabase = supabaseServer();
    const { data, error } = await supabase.rpc('process_fantasy_transfer', {
      p_user_id: userId,
      p_fantasy_season_id: fantasySeasonId,
      p_transfers_in: transfersIn,
      p_transfers_out: transfersOut,
    });

    if (error) {
      console.error('Supabase RPC Error (process_fantasy_transfer):', error);
      return NextResponse.json(
        { error: 'Database error occurred during transfer processing.', details: error.message },
        { status: 500 }
      );
    }

    // 4. Handle RPC custom response
    if (data && data.success === false) {
      return NextResponse.json(
        { error: data.message || 'Transfer failed validation.' },
        { status: 400 } // Bad request due to business logic validation
      );
    }

    return NextResponse.json({
      message: data.message || 'Transfers processed successfully.',
      budget: data.budget,
      free_transfers_remaining: data.free_transfers_remaining,
      penalty_points: data.penalty_points,
    });
  } catch (error: unknown) {
    console.error('Transfer API Error:', error);
    
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred processing the transfer.' },
      { status: 500 }
    );
  }
}
