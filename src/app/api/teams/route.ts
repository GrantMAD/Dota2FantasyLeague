import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

/**
 * GET /api/teams - Fetch all professional teams
 * Query params:
 *   - limit: Limit results (default: 100)
 *   - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const searchParams = request.nextUrl.searchParams;
    
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const { data, error } = await supabase
      .from('professional_teams')
      .select('*')
      .range(offset, offset + limit - 1);
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch teams', details: error.message },
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
 * POST /api/teams - Create a new professional team (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const body = await request.json();
    
    // TODO: Add admin authorization check
    
    const { data, error } = await supabase
      .from('professional_teams')
      .insert([body])
      .select();
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to create team', details: error.message },
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
