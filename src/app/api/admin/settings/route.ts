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
      .select('id, season_id, gameweek_number, start_date, end_date, deadline_date, status')
      .in('status', ['upcoming', 'active'])
      .order('gameweek_number', { ascending: true });

    if (gameweeksError) {
      return NextResponse.json({ error: 'Failed to fetch gameweeks', details: gameweeksError.message }, { status: 500 });
    }

    return NextResponse.json({ seasons: seasons || [], gameweeks: gameweeks || [] });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}

/**
 * PUT /api/admin/settings
 * Updates season status or a gameweek deadline.
 * Body: { type: 'season' | 'gameweek', id: number, status?: string, deadline_date?: string }
 */
export async function PUT(request: NextRequest) {
  try {
    await verifyAdminAuth(request);
    const supabase = supabaseServer();
    const body = await request.json();
    const { type, id, status, deadline_date } = body;

    if (!type || !id) {
      return NextResponse.json({ error: 'Missing required fields: type, id' }, { status: 400 });
    }

    if (type === 'season') {
      const validStatuses = ['planning', 'active', 'ended', 'archived'];
      if (!status || !validStatuses.includes(status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('seasons')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to update season', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    }

    if (type === 'gameweek') {
      if (!deadline_date) {
        return NextResponse.json({ error: 'Missing deadline_date for gameweek update' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('gameweeks')
        .update({ deadline_date })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to update gameweek deadline', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ error: 'Invalid type. Must be "season" or "gameweek"' }, { status: 400 });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}
