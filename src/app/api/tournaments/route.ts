import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

/**
 * GET /api/tournaments
 * Returns tournaments, optionally filtered by seasonId and/or status.
 * Query params: seasonId, status (eligible|excluded|provisional|archived)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const status = searchParams.get('status');

    const supabase = supabaseServer();
    let query = (supabase.from('tournaments') as any)
      .select(`
        id,
        season_id,
        name,
        slug,
        status,
        tier,
        start_date,
        end_date,
        eligible,
        last_synced_at
      `)
      .order('start_date', { ascending: false });

    if (seasonId) query = query.eq('season_id', seasonId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch tournaments.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ tournaments: data ?? [] });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
