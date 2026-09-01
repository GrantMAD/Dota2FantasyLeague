import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, AuthError } from '@/lib/auth-utils';

interface RouteContext {
  params: { id: string };
}

/**
 * PUT /api/players/[id]/availability
 * Admin only. Updates a player's availability status and reason.
 * Body: { status: string, reason: string | null }
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    await verifyAuth(request);

    const playerId = parseInt(context.params.id, 10);
    if (isNaN(playerId)) {
      return NextResponse.json({ error: 'Invalid player ID.' }, { status: 400 });
    }

    const body = await request.json();
    const { status, reason } = body;

    if (!status || typeof status !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing status.' }, { status: 400 });
    }

    const validStatuses = ['available', 'unavailable', 'injured', 'visa_issues', 'benched'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from('professional_players')
      .update({
        availability_status: status,
        availability_reason: reason || null,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', playerId)
      .select('id, name, availability_status, availability_reason')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update player availability.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Availability updated successfully.', player: data });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
