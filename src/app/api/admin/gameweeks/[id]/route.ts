import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { createErrorResponse, verifyAdminAuth } from '@/lib/auth-utils';

type GameweekStatus = 'upcoming' | 'active' | 'locked' | 'closed';

const VALID_TRANSITIONS: Record<GameweekStatus, GameweekStatus[]> = {
  upcoming: ['active'],
  active: ['locked', 'closed'],
  locked: ['closed'],
  closed: ['upcoming'],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await verifyAdminAuth(request);
    const { id } = await params;
    const gameweekId = Number(id);
    if (!Number.isInteger(gameweekId) || gameweekId <= 0) {
      return NextResponse.json({ error: 'Invalid gameweek ID.' }, { status: 400 });
    }

    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || !('status' in body)) {
      return NextResponse.json({ error: 'A target gameweek status is required.' }, { status: 400 });
    }
    const targetStatus = body.status as GameweekStatus;
    if (!Object.prototype.hasOwnProperty.call(VALID_TRANSITIONS, targetStatus)) {
      return NextResponse.json(
        { error: 'Invalid gameweek status. Must be upcoming, active, locked, or closed.' },
        { status: 400 },
      );
    }

    const supabase = supabaseServer();
    const { data: gameweek, error: fetchError } = await supabase
      .from('gameweeks')
      .select('id, status')
      .eq('id', gameweekId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to load gameweek.', details: fetchError.message },
        { status: 500 },
      );
    }
    if (!gameweek) {
      return NextResponse.json({ error: 'Gameweek not found.' }, { status: 404 });
    }

    const currentStatus = gameweek.status as GameweekStatus;
    if (!VALID_TRANSITIONS[currentStatus]?.includes(targetStatus)) {
      return NextResponse.json(
        { error: `Cannot transition gameweek from ${gameweek.status} to ${targetStatus}.` },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from('gameweeks')
      .update({ status: targetStatus, updated_at: new Date().toISOString() })
      .eq('id', gameweekId)
      .eq('status', currentStatus)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update gameweek status.', details: error.message },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: 'Gameweek status changed before this update could be applied. Refresh and try again.' },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}
