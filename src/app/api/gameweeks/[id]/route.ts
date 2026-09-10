import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/gameweeks/[id]
 * Returns a single gameweek with its matches and double/blank team flags.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const gameweekId = parseInt(params.id, 10);
    if (isNaN(gameweekId)) {
      return NextResponse.json({ error: 'Invalid gameweek ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Fetch gameweek
    const { data: gameweek, error: gwError } = await (supabase
      .from('gameweeks') as any)
      .select('*')
      .eq('id', gameweekId)
      .maybeSingle();

    if (gwError) {
      return NextResponse.json(
        { error: 'Failed to fetch gameweek.', details: gwError.message },
        { status: 500 }
      );
    }

    if (!gameweek) {
      return NextResponse.json({ error: 'Gameweek not found.' }, { status: 404 });
    }

    // Fetch matches in this gameweek
    const { data: matches } = await (supabase
      .from('matches') as any)
      .select(`
        id,
        status,
        scheduled_at,
        radiant_team_id,
        dire_team_id,
        winner_team_id,
        duration_seconds,
        professional_teams!matches_radiant_team_id_fkey(id, name, tag),
        dire_team:professional_teams!matches_dire_team_id_fkey(id, name, tag)
      `)
      .eq('gameweek_id', gameweekId)
      .order('scheduled_at', { ascending: true });

    // Fetch double/blank team flags for this gameweek
    const { data: flags } = await (supabase
      .from('gameweek_team_flags') as any)
      .select(`
        id,
        flag,
        team_id,
        professional_teams(id, name, tag)
      `)
      .eq('gameweek_id', gameweekId);

    return NextResponse.json({
      gameweek,
      matches: matches ?? [],
      teamFlags: flags ?? [],
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * PATCH /api/gameweeks/[id]
 * Updates mutable fields on a gameweek (status, deadline, start_date, end_date).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const gameweekId = parseInt(params.id, 10);
    if (isNaN(gameweekId)) {
      return NextResponse.json({ error: 'Invalid gameweek ID.' }, { status: 400 });
    }

    const body = await request.json();

    const VALID_STATUSES = ['upcoming', 'active', 'locked'];
    const allowed = ['status', 'deadline', 'start_date', 'end_date'];
    const update: Record<string, unknown> = {};

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        if (key === 'status' && !VALID_STATUSES.includes(body[key])) {
          return NextResponse.json(
            { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
            { status: 400 }
          );
        }
        update[key] = body[key];
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    const { data, error } = await (supabase.from('gameweeks') as any)
      .update(update)
      .eq('id', gameweekId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update gameweek.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
