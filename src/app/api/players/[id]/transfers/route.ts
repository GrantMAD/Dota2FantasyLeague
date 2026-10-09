import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';


interface RouteContext {
  params: Promise<{ id: string }>;
}

interface TeamSummary {
  id: number;
  name: string;
  tag: string | null;
}

interface TransferHistoryRecord {
  id: number;
  change_type: string;
  changed_at: string;
  role: string | null;
  team_id: number | null;
  previous_team_id: number | null;
  professional_teams: TeamSummary | TeamSummary[] | null;
}

interface PlayerTeamContext {
  availability_status: string | null;
  professional_teams: TeamSummary | TeamSummary[] | null;
}

/**
 * GET /api/players/[id]/transfers
 * Returns a player's full professional team transfer history.
 * Joins with professional_teams to include readable team names.
 */
async function getHandler(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const playerId = parseInt(params.id, 10);
    if (isNaN(playerId)) {
      return NextResponse.json({ error: 'Invalid player ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Fetch transfer history, joined with team names for display
    const { data, error } = await supabase
      .from('team_roster_history')
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
    const { data: playerData } = await supabase
      .from('professional_players')
      .select('id, name, team_id, availability_status, professional_teams(id, name, tag)')
      .eq('id', playerId)
      .maybeSingle();
    const player = playerData as PlayerTeamContext | null;
    const transferHistory = (data ?? []) as TransferHistoryRecord[];

    return NextResponse.json({
      playerId,
      currentTeam: player?.professional_teams ?? null,
      availabilityStatus: player?.availability_status ?? null,
      transferHistory,
    });
  } catch (error: unknown) {
    console.error('Player Transfers API Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred fetching player transfer history.' },
      { status: 500 }
    );
  }
}

export const GET = withApiTelemetry('GET', '/api/players/:id/transfers', getHandler);
