import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

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
    
    const teamId = searchParams.get('team_id');
    const role = searchParams.get('role');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let query = supabase
      .from('professional_players')
      .select('*')
      .range(offset, offset + limit - 1);
    
    if (teamId) {
      query = query.eq('team_id', parseInt(teamId));
    }
    
    if (role) {
      query = query.eq('primary_role', role);
    }
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch players', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ data, count: data?.length || 0 });
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
