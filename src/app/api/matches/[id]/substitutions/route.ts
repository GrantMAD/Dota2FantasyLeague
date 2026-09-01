import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, AuthError } from '@/lib/auth-utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/matches/[id]/substitutions
 * Returns all substitutions for a given match.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const matchId = parseInt(params.id, 10);
    if (isNaN(matchId)) {
      return NextResponse.json({ error: 'Invalid match ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data, error } = await (supabase
      .from('match_player_substitutions') as any)
      .select(`
        id,
        rostered_player_id,
        stand_in_player_id,
        rostered_player:professional_players!match_player_substitutions_rostered_player_id_fkey(id, name, tag),
        stand_in_player:professional_players!match_player_substitutions_stand_in_player_id_fkey(id, name, tag)
      `)
      .eq('match_id', matchId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch substitutions.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ matchId, substitutions: data ?? [] });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * POST /api/matches/[id]/substitutions
 * Admin only. Registers a stand-in for a rostered player in a specific match.
 * Body: { rosteredPlayerId: number, standInPlayerId: number }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await verifyAuth(request);

    const params = await context.params;
    const matchId = parseInt(params.id, 10);
    if (isNaN(matchId)) {
      return NextResponse.json({ error: 'Invalid match ID.' }, { status: 400 });
    }

    const body = await request.json();
    const { rosteredPlayerId, standInPlayerId } = body;

    if (!rosteredPlayerId || typeof rosteredPlayerId !== 'number') {
      return NextResponse.json({ error: 'Invalid or missing rosteredPlayerId.' }, { status: 400 });
    }

    if (!standInPlayerId || typeof standInPlayerId !== 'number') {
      return NextResponse.json({ error: 'Invalid or missing standInPlayerId.' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data, error } = await (supabase
      .from('match_player_substitutions') as any)
      .insert({
        match_id: matchId,
        rostered_player_id: rosteredPlayerId,
        stand_in_player_id: standInPlayerId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create substitution.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Substitution created successfully.', substitution: data });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * DELETE /api/matches/[id]/substitutions
 * Admin only. Removes a substitution mapping.
 * Body: { id: number } (The primary key of the match_player_substitutions table)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await verifyAuth(request);

    const params = await context.params;
    const matchId = parseInt(params.id, 10);
    if (isNaN(matchId)) {
      return NextResponse.json({ error: 'Invalid match ID.' }, { status: 400 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== 'number') {
      return NextResponse.json({ error: 'Invalid or missing substitution ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { error } = await (supabase
      .from('match_player_substitutions') as any)
      .delete()
      .eq('id', id)
      .eq('match_id', matchId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete substitution.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Substitution removed successfully.' });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
