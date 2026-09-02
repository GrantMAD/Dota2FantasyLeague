import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/response-cache';

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
    const cacheKey = `gameweeks:${searchParams.toString()}`;
    const cached = getCached<{ gameweeks: unknown[] }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const supabase = supabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('gameweeks') as any)
      .select(`
        id,
        season_id,
        gameweek_number,
        start_date,
        end_date,
        deadline,
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

    const response = { gameweeks: data ?? [] };
    setCached(cacheKey, response, 60_000);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
