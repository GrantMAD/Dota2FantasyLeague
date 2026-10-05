import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { createErrorResponse, verifyAdminAuth } from '@/lib/auth-utils';

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
    await verifyAdminAuth(request);
    const body: unknown = await request.json();
    const allowedFields = [
      'name',
      'slug',
      'status',
      'start_date',
      'end_date',
      'starting_budget',
      'max_players_per_team',
      'squad_size',
      'starters_required',
      'bench_size',
    ];
    if (
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).some((field) => !allowedFields.includes(field))
    ) {
      return NextResponse.json({ error: 'Invalid season fields.' }, { status: 400 });
    }

    const supabase = supabaseServer();
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
  } catch (error: unknown) {
    return createErrorResponse(error as Error);
  }
}
