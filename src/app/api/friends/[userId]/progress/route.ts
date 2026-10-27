import { NextRequest, NextResponse } from 'next/server';
import { applyRefreshedTokens, verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: Promise<{ userId: string }>;
}

function responseWithAuth(
  body: Record<string, unknown>,
  status: number,
  auth: Awaited<ReturnType<typeof verifyAuth>>,
) {
  const response = NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
  applyRefreshedTokens(response, auth);
  return response;
}

async function getHandler(request: NextRequest, { params }: RouteContext) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    auth = await verifyAuth(request);
    const { userId: followedUserId } = await params;
    if (!USER_ID_PATTERN.test(followedUserId) || followedUserId === auth.userId) {
      return responseWithAuth({ error: 'A valid followed user is required.' }, 400, auth);
    }

    const db = supabaseServer();
    const { data: relationship, error: relationshipError } = await db.from('user_follows')
      .select('id')
      .eq('follower_id', auth.userId)
      .eq('followed_id', followedUserId)
      .maybeSingle();
    if (relationshipError) throw new Error(`Unable to verify follow relationship: ${relationshipError.message}`);
    if (!relationship) {
      return responseWithAuth({ error: 'Follow this manager to view their progress.' }, 404, auth);
    }

    const [{ data: user, error: userError }, activeSeasonResult] = await Promise.all([
      db.from('users')
        .select('id, username, display_name, avatar_url')
        .eq('id', followedUserId)
        .maybeSingle(),
      db.from('seasons')
        .select('id, name')
        .eq('status', 'active')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (userError) throw new Error(`Unable to load followed manager: ${userError.message}`);
    if (!user) return responseWithAuth({ error: 'Followed manager not found.' }, 404, auth);
    if (activeSeasonResult.error) throw new Error(`Unable to load the active season: ${activeSeasonResult.error.message}`);

    let season = activeSeasonResult.data;
    if (!season) {
      const { data: endedSeason, error: endedSeasonError } = await db.from('seasons')
        .select('id, name')
        .eq('status', 'ended')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (endedSeasonError) throw new Error(`Unable to load the latest completed season: ${endedSeasonError.message}`);
      season = endedSeason;
    }

    if (!season) {
      return responseWithAuth({ manager: user, season: null }, 200, auth);
    }

    const responseBody = {
      manager: user,
      season: {
        id: season.id,
        name: season.name,
        total_points: 0,
        global_rank: null as number | null,
        gameweeks: [] as Array<{
          id: number;
          gameweek_number: number;
          gameweek_points: number;
          total_points: number;
          rank: number;
          updated_at: string;
        }>,
      },
    };

    const { data: fantasySeason, error: fantasySeasonError } = await db.from('fantasy_seasons')
      .select('id, total_points, global_rank')
      .eq('user_id', followedUserId)
      .eq('season_id', season.id)
      .maybeSingle();
    if (fantasySeasonError) throw new Error(`Unable to load followed manager season progress: ${fantasySeasonError.message}`);

    if (fantasySeason) {
      const { data: standings, error: standingsError } = await db.from('season_standings')
        .select('id, rank, total_points, gameweek_points, gameweek_id, updated_at')
        .eq('fantasy_season_id', fantasySeason.id)
        .is('league_id', null)
        .order('gameweek_id', { ascending: false })
        .limit(30);
      if (standingsError) throw new Error(`Unable to load gameweek progress: ${standingsError.message}`);

      const gameweekIds = [...new Set((standings ?? []).map((row) => row.gameweek_id))];
      const { data: gameweeks, error: gameweeksError } = gameweekIds.length
        ? await db.from('gameweeks')
          .select('id, gameweek_number, status')
          .in('id', gameweekIds)
        : { data: [], error: null };
      if (gameweeksError) throw new Error(`Unable to load progress gameweek details: ${gameweeksError.message}`);

      const gameweekById = new Map((gameweeks ?? []).map((gameweek) => [gameweek.id, gameweek]));
      responseBody.season.total_points = Number(fantasySeason.total_points ?? 0);
      responseBody.season.global_rank = fantasySeason.global_rank;
      responseBody.season.gameweeks = (standings ?? [])
        .flatMap((standing) => {
          const gameweek = gameweekById.get(standing.gameweek_id);
          if (!gameweek || gameweek.status !== 'closed') return [];
          return [{
            id: gameweek.id,
            gameweek_number: gameweek.gameweek_number,
            gameweek_points: Number(standing.gameweek_points ?? 0),
            total_points: Number(standing.total_points ?? 0),
            rank: standing.rank,
            updated_at: standing.updated_at,
          }];
        });
    }

    return responseWithAuth(responseBody, 200, auth);
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: number }).status)
      : 500;
    if (status >= 500) console.error('[Friends] Failed to load followed manager progress:', error);
    const response = NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to load followed manager progress.',
    }, { status, headers: { 'Cache-Control': 'private, no-store' } });
    if (auth) applyRefreshedTokens(response, auth);
    return response;
  }
}

export const GET = withApiTelemetry('GET', '/api/friends/:userId/progress', getHandler);
