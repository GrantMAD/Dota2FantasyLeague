import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, AuthError } from '@/lib/auth-utils';
import { logAuditAction } from '@/lib/audit-logger';

/**
 * GET /api/fantasy/lineup
 * Returns the authenticated user's lineup for a given gameweek.
 * Query params: gameweekId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const gameweekId = searchParams.get('gameweekId');
    if (!gameweekId) {
      return NextResponse.json({ error: 'gameweekId is required.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Get user's fantasy team
    const { data: fantasyTeam } = await (supabase
      .from('fantasy_teams') as any)
      .select('id')
      .eq('user_id', user.userId)
      .maybeSingle();

    if (!fantasyTeam) {
      return NextResponse.json({ error: 'Fantasy team not found.' }, { status: 404 });
    }

    const { data: lineup, error } = await (supabase
      .from('fantasy_lineups') as any)
      .select(`
        id,
        slot,
        is_starter,
        is_captain,
        is_vice_captain,
        player_id,
        professional_players(
          id,
          name,
          in_game_name,
          primary_role,
          profile_image_url,
          availability_status,
          availability_reason,
          current_price,
          professional_teams(id, name, tag)
        )
      `)
      .eq('fantasy_team_id', fantasyTeam.id)
      .eq('gameweek_id', gameweekId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch lineup.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ fantasyTeamId: fantasyTeam.id, gameweekId, lineup: lineup ?? [] });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * PUT /api/fantasy/lineup
 * Saves the user's lineup for a gameweek. Validates the deadline has not passed.
 * Body: { gameweekId: number, lineup: Array<{ playerId: number, slot: string, isCaptain: boolean, isViceCaptain: boolean }> }
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const { gameweekId, lineup } = body;

    if (!gameweekId || !Array.isArray(lineup)) {
      return NextResponse.json(
        { error: 'gameweekId and lineup array are required.' },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Verify the gameweek deadline has not passed
    const { data: gameweek } = await (supabase
      .from('gameweeks') as any)
      .select('id, status, deadline_date')
      .eq('id', gameweekId)
      .maybeSingle();

    if (!gameweek) {
      return NextResponse.json({ error: 'Gameweek not found.' }, { status: 404 });
    }

    if (gameweek.status === 'closed') {
      return NextResponse.json(
        { error: 'Transfers are closed for this gameweek.' },
        { status: 400 }
      );
    }

    if (gameweek.deadline_date && new Date(gameweek.deadline_date) < new Date()) {
      return NextResponse.json(
        { error: 'The gameweek deadline has passed. Lineup changes are locked.' },
        { status: 400 }
      );
    }

    // Get user's fantasy team
    const { data: fantasyTeam } = await (supabase
      .from('fantasy_teams') as any)
      .select('id')
      .eq('user_id', user.userId)
      .maybeSingle();

    if (!fantasyTeam) {
      return NextResponse.json({ error: 'Fantasy team not found.' }, { status: 404 });
    }

    // Validate exactly one captain and one vice-captain
    const captains = lineup.filter((p: any) => p.isCaptain);
    const viceCaptains = lineup.filter((p: any) => p.isViceCaptain);
    if (captains.length !== 1) {
      return NextResponse.json({ error: 'You must select exactly one captain.' }, { status: 400 });
    }
    if (viceCaptains.length !== 1) {
      return NextResponse.json(
        { error: 'You must select exactly one vice-captain.' },
        { status: 400 }
      );
    }

    // Build upsert rows
    const rows = lineup.map((entry: any) => ({
      fantasy_team_id: fantasyTeam.id,
      gameweek_id: gameweekId,
      player_id: entry.playerId,
      slot: entry.slot,
      is_starter: entry.slot ? !entry.slot.startsWith('bench') : true,
      is_captain: entry.isCaptain ?? false,
      is_vice_captain: entry.isViceCaptain ?? false,
    }));

    // Delete existing lineup for this gameweek then insert fresh
    await (supabase
      .from('fantasy_lineups') as any)
      .delete()
      .eq('fantasy_team_id', fantasyTeam.id)
      .eq('gameweek_id', gameweekId);

    const { data, error } = await (supabase
      .from('fantasy_lineups') as any)
      .insert(rows)
      .select();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to save lineup.', details: error.message },
        { status: 500 }
      );
    }

    await logAuditAction({
      tableName: 'fantasy_lineups',
      recordId: fantasyTeam.id,
      action: 'LINEUP_CHANGE',
      changedBy: user.userId,
      newValues: { gameweek_id: gameweekId, player_count: rows.length },
      reason: 'User saved lineup',
    });

    return NextResponse.json({ message: 'Lineup saved successfully.', lineup: data });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
