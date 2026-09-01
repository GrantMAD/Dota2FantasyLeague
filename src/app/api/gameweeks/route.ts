import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

/**
 * GET /api/gameweeks
 * Returns all gameweeks, optionally filtered by season and/or status.
 * Query params: seasonId, status (upcoming|active|closed)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const status = searchParams.get('status');

    const supabase = supabaseServer();
    let query = (supabase.from('gameweeks') as any)
      .select(`
        id,
        season_id,
        gameweek_number,
        start_date,
        end_date,
        deadline_date,
        status,
        created_at
      `)
      .order('gameweek_number', { ascending: true });

    if (seasonId) query = query.eq('season_id', seasonId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch gameweeks.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ gameweeks: data ?? [] });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
