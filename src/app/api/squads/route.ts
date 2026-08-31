import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/squads - Fetch user's fantasy squads
 * Query params:
 *   - season_id: Filter by season
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    let query = supabase
      .from('fantasy_squads')
      .select(
        `
        id,
        name,
        fantasy_season_id,
        created_at,
        updated_at,
        fantasy_seasons(id, user_id, season_id),
        fantasy_squad_members(id, player_id, cost)
      `
      )
      .eq('fantasy_seasons.user_id', user.id);
    
    if (seasonId) {
      query = query.eq('fantasy_seasons.season_id', parseInt(seasonId));
    }
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch squads', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/squads - Create a new fantasy squad
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Verify user owns the fantasy_season
    const { data: fantasySeasonData, error: fantasySeasonError } = await supabase
      .from('fantasy_seasons')
      .select('id')
      .eq('id', body.fantasy_season_id)
      .eq('user_id', user.id)
      .single();
    
    if (fantasySeasonError || !fantasySeasonData) {
      return NextResponse.json(
        { error: 'Unauthorized: Fantasy season not found' },
        { status: 403 }
      );
    }
    
    const { data, error } = await supabase
      .from('fantasy_squads')
      .insert([{ fantasy_season_id: body.fantasy_season_id, name: body.name || 'My Squad' }])
      .select();
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to create squad', details: error.message },
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
