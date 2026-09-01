import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/players/[id]/transfers
 * Returns a player's full professional team transfer history.
 * Joins with professional_teams to include readable team names.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const playerId = parseInt(context.params.id, 10);
    if (isNaN(playerId)) {
      return NextResponse.json({ error: 'Invalid player ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Fetch transfer history, joined with team names for display
    const { data, error } = await (supabase
      .from('team_roster_history') as any)
      .select(`
        id,
        change_type,
        changed_at,
        role,
        team_id,
        previous_team_id,
        professional_teams!team_roster_history_team_id_fkey (
          id,
          name,
          tag
        )
      `)
      .eq('player_id', playerId)
      .order('changed_at', { ascending: false });

    if (error) {
      console.error('Supabase Error (player transfers):', error);
      return NextResponse.json(
        { error: 'Failed to fetch player transfer history.', details: error.message },
        { status: 500 }
      );
    }

    // Also fetch the player's current team for context
    const { data: player } = await (supabase
      .from('professional_players') as any)
      .select('id, name, team_id, availability_status, professional_teams(id, name, tag)')
      .eq('id', playerId)
      .maybeSingle();

    return NextResponse.json({
      playerId,
      currentTeam: player?.professional_teams ?? null,
      availabilityStatus: player?.availability_status ?? null,
      transferHistory: data ?? [],
    });
  } catch (error: unknown) {
    console.error('Player Transfers API Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred fetching player transfer history.' },
      { status: 500 }
    );
  }
}
