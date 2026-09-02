import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAdminAuth, createErrorResponse } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    await verifyAdminAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const statusFilter = searchParams.get('status');

    const supabase = supabaseServer();

    let query = supabase
      .from('matches')
      .select(`
        *,
        team_a:professional_teams!matches_team_a_id_fkey(id, name, logo_url),
        team_b:professional_teams!matches_team_b_id_fkey(id, name, logo_url),
        tournament:tournaments(name, tier)
      `, { count: 'exact' })
      .order('scheduled_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch matches', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, total: count, limit, offset });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}
