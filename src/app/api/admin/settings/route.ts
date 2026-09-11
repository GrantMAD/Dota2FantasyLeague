import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAdminAuth, createErrorResponse } from '@/lib/auth-utils';

/**
 * GET /api/admin/settings
 * Returns active season + upcoming gameweeks for admin management.
 */
export async function GET(request: NextRequest) {
  try {
    await verifyAdminAuth(request);
    const supabase = supabaseServer();

    // Fetch all seasons ordered most recent first
    const { data: seasons, error: seasonsError } = await supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false });

    if (seasonsError) {
      return NextResponse.json({ error: 'Failed to fetch seasons', details: seasonsError.message }, { status: 500 });
    }

    // Fetch upcoming/active gameweeks for deadline overrides
    const { data: gameweeks, error: gameweeksError } = await supabase
      .from('gameweeks')
      .select('id, season_id, gameweek_number, start_date, end_date, deadline, status, is_international_break')
      .in('status', ['upcoming', 'active'])
      .order('gameweek_number', { ascending: true });

    if (gameweeksError) {
      return NextResponse.json({ error: 'Failed to fetch gameweeks', details: gameweeksError.message }, { status: 500 });
    }

    const normalizedGameweeks = (gameweeks || []).map((gw: any) => ({
      ...gw,
      deadline_date: gw.deadline,
      is_international_break: !!gw.is_international_break,
    }));

    return NextResponse.json({ seasons: seasons || [], gameweeks: normalizedGameweeks });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}

/**
 * PUT /api/admin/settings
 * Updates season settings or a gameweek deadline / status.
 * Body: 
 * - season: { type: 'season', id: number, status?: string, starting_budget?: number, max_players_per_team?: number, squad_size?: number, starters_required?: number, bench_size?: number }
 * - gameweek: { type: 'gameweek', id: number, deadline_date?: string, is_international_break?: boolean }
 */
export async function PUT(request: NextRequest) {
  try {
    await verifyAdminAuth(request);
    const supabase = supabaseServer();
    const body = await request.json();
    const { type, id, status, deadline_date, is_international_break, ...extraFields } = body;

    if (!type || !id) {
      return NextResponse.json({ error: 'Missing required fields: type, id' }, { status: 400 });
    }

    if (type === 'season') {
      const updates: Record<string, any> = {};

      if (status !== undefined) {
        const validStatuses = ['planning', 'active', 'ended', 'archived'];
        if (!validStatuses.includes(status)) {
          return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
        }
        updates.status = status;
      }

      if (extraFields.starting_budget !== undefined) {
        updates.starting_budget = Number(extraFields.starting_budget);
      }
      if (extraFields.max_players_per_team !== undefined) {
        updates.max_players_per_team = Number(extraFields.max_players_per_team);
      }
      if (extraFields.squad_size !== undefined) {
        updates.squad_size = Number(extraFields.squad_size);
      }
      if (extraFields.starters_required !== undefined) {
        updates.starters_required = Number(extraFields.starters_required);
      }
      if (extraFields.bench_size !== undefined) {
        updates.bench_size = Number(extraFields.bench_size);
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid update fields provided for season' }, { status: 400 });
      }

      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('seasons')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to update season', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    }

    if (type === 'gameweek') {
      const updates: Record<string, any> = {};

      if (deadline_date !== undefined) {
        updates.deadline = deadline_date;
      }
      if (is_international_break !== undefined) {
        updates.is_international_break = Boolean(is_international_break);
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid update fields provided for gameweek' }, { status: 400 });
      }

      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('gameweeks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to update gameweek', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ error: 'Invalid type. Must be "season" or "gameweek"' }, { status: 400 });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}
