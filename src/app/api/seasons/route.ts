import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

/**
 * GET /api/seasons - Fetch all seasons
 * Query params:
 *   - status: Filter by status (planning, active, ended, archived)
 *   - limit: Limit results (default: 50)
 *   - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const searchParams = request.nextUrl.searchParams;
    
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let query = supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch seasons', details: error.message },
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
 * POST /api/seasons - Create a new season (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const body = await request.json();
    
    // TODO: Add admin authorization check
    
    const { data, error } = await supabase
      .from('seasons')
      .insert([body])
      .select();
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to create season', details: error.message },
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
