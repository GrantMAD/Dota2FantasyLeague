import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/response-cache';

/**
 * GET /api/players - Fetch all professional players
 * Query params:
 *   - season_id: Filter by season (optional)
 *   - team_id: Filter by team (optional)
 *   - role: Filter by role (optional)
 *   - limit: Limit results (default: 100)
 *   - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const searchParams = request.nextUrl.searchParams;
    const cacheKey = `players:${searchParams.toString()}`;
    const cached = getCached<{ data: unknown[]; total: number | null; limit: number; offset: number }>(cacheKey);
    if (cached) return NextResponse.json(cached);
    
    const teamId = searchParams.get('team_id');
    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sort');
    const sortDesc = searchParams.get('desc') !== 'false'; // default true
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let query = supabase
      .from('professional_players')
      .select('*, professional_teams(name, logo_url)', { count: 'exact' })
      .range(offset, offset + limit - 1);
    
    if (teamId) {
      query = query.eq('team_id', parseInt(teamId));
    }
    
    if (role) {
      query = query.eq('primary_role', role);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,in_game_name.ilike.%${search}%`);
    }

    if (sortBy === 'price') {
      query = query.order('current_price', { ascending: !sortDesc });
    } else {
      query = query.order('name', { ascending: true });
    }
    
    const { data, count, error } = await query;
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch players', details: error.message },
        { status: 500 }
      );
    }
    
    const response = { data, total: count, limit, offset };
    setCached(cacheKey, response, 60_000);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/players - Create a new professional player (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const body = await request.json();
    
    // TODO: Add admin authorization check
    
    const { data, error } = await supabase
      .from('professional_players')
      .insert([body])
      .select();
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to create player', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
