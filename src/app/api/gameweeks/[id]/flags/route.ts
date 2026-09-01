import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, AuthError } from '@/lib/auth-utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/gameweeks/[id]/flags
 * Returns all double/blank team flags for a specific gameweek.
 * Used by the frontend to warn users which teams have special gameweek status.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const gameweekId = parseInt(params.id, 10);
    if (isNaN(gameweekId)) {
      return NextResponse.json({ error: 'Invalid gameweek ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data, error } = await (supabase
      .from('gameweek_team_flags') as any)
      .select(`
        id,
        flag,
        team_id,
        professional_teams (
          id,
          name,
          tag
        )
      `)
      .eq('gameweek_id', gameweekId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch gameweek flags.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ gameweekId, flags: data ?? [] });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * POST /api/gameweeks/[id]/flags
 * Admin only. Adds a double or blank flag for a team in a gameweek.
 * Body: { teamId: number, flag: 'double' | 'blank' }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Only authenticated users (admins) can set flags
    await verifyAuth(request);

    const params = await context.params;
    const gameweekId = parseInt(params.id, 10);
    if (isNaN(gameweekId)) {
      return NextResponse.json({ error: 'Invalid gameweek ID.' }, { status: 400 });
    }

    const body = await request.json();
    const { teamId, flag } = body;

    if (!teamId || typeof teamId !== 'number') {
      return NextResponse.json({ error: 'Invalid or missing teamId.' }, { status: 400 });
    }

    if (!flag || !['double', 'blank'].includes(flag)) {
      return NextResponse.json(
        { error: 'flag must be either "double" or "blank".' },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();
    const { data, error } = await (supabase
      .from('gameweek_team_flags') as any)
      .upsert(
        { gameweek_id: gameweekId, team_id: teamId, flag },
        { onConflict: 'gameweek_id,team_id' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to set gameweek flag.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Flag set successfully.', flag: data });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * DELETE /api/gameweeks/[id]/flags
 * Admin only. Removes a double or blank flag for a team in a gameweek.
 * Body: { teamId: number }
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await verifyAuth(request);

    const params = await context.params;
    const gameweekId = parseInt(params.id, 10);
    if (isNaN(gameweekId)) {
      return NextResponse.json({ error: 'Invalid gameweek ID.' }, { status: 400 });
    }

    const body = await request.json();
    const { teamId } = body;

    if (!teamId || typeof teamId !== 'number') {
      return NextResponse.json({ error: 'Invalid or missing teamId.' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { error } = await (supabase
      .from('gameweek_team_flags') as any)
      .delete()
      .eq('gameweek_id', gameweekId)
      .eq('team_id', teamId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to remove gameweek flag.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Flag removed successfully.' });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
