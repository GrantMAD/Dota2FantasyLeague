import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/response-cache';
import { createErrorResponse, verifyAdminAuth } from '@/lib/auth-utils';
import { withApiTelemetry } from '@/lib/api-telemetry';
import { getPlayersCatalogData, PlayersCatalogError, type PlayersCatalogResponse } from '@/lib/players-catalog';

/**
 * GET /api/players - Fetch all professional players
 * Query params:
 *   - season_id: Filter by season (optional)
 *   - team_id: Filter by team (optional)
 *   - role: Filter by role (optional)
 *   - limit: Limit results (default: 100)
 *   - offset: Pagination offset (default: 0)
 */
async function getHandler(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cacheKey = `players:${searchParams.toString()}`;
  const cacheHeaders = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' };
  const cached = getCached<PlayersCatalogResponse>(cacheKey);
  if (cached !== null) return NextResponse.json(cached, { headers: cacheHeaders });

  try {
    const response = await getPlayersCatalogData(supabaseServer(), searchParams);
    setCached(cacheKey, response, 60_000);
    return NextResponse.json(response, { headers: cacheHeaders });
  } catch (error) {
    if (error instanceof PlayersCatalogError) {
      return NextResponse.json(
        { error: error.responseMessage, details: error.details },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/players - Create a new professional player (admin only)
 */
async function postHandler(request: NextRequest) {
  try {
    await verifyAdminAuth(request);
    const body: unknown = await request.json();
    const allowedFields = [
      'name',
      'slug',
      'in_game_name',
      'team_id',
      'primary_role',
      'secondary_roles',
      'profile_image_url',
      'country',
      'data_provider_id',
      'availability_status',
      'last_synced_at',
      'current_price',
    ];
    if (
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).some((field) => !allowedFields.includes(field))
    ) {
      return NextResponse.json({ error: 'Invalid player fields.' }, { status: 400 });
    }

    const supabase = supabaseServer();
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
  } catch (error: unknown) {
    return createErrorResponse(error as Error);
  }
}

export const GET = withApiTelemetry('GET', '/api/players', getHandler);
export const POST = withApiTelemetry('POST', '/api/players', postHandler);
