import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/tournaments/[id]
 * Returns a single tournament with its series and matches.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tournamentId = parseInt(context.params.id, 10);
    if (isNaN(tournamentId)) {
      return NextResponse.json({ error: 'Invalid tournament ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    const { data: tournament, error: tError } = await (supabase
      .from('tournaments') as any)
      .select('*')
      .eq('id', tournamentId)
      .maybeSingle();

    if (tError) {
      return NextResponse.json(
        { error: 'Failed to fetch tournament.', details: tError.message },
        { status: 500 }
      );
    }

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found.' }, { status: 404 });
    }

    // Fetch matches for this tournament
    const { data: matches } = await (supabase
      .from('matches') as any)
      .select(`
        id,
        status,
        scheduled_at,
        duration_seconds,
        gameweek_id,
        radiant_team_id,
        dire_team_id,
        winner_team_id,
        radiant_team:professional_teams!matches_radiant_team_id_fkey(id, name, tag),
        dire_team:professional_teams!matches_dire_team_id_fkey(id, name, tag)
      `)
      .eq('tournament_id', tournamentId)
      .order('scheduled_at', { ascending: true });

    return NextResponse.json({
      tournament,
      matches: matches ?? [],
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
