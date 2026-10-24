import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/response-cache';
import { withApiTelemetry } from '@/lib/api-telemetry';
import { verifyAuth } from '@/lib/auth-utils';
import {
  LeaderboardDataError,
  getCurrentUserLeaderboardEntry,
  getLeaderboardData,
  type LeaderboardData,
} from '@/lib/leaderboard-data';

/**
 * GET /api/leaderboard
 * Returns paginated global leaderboard from the latest ranking snapshots.
 * Query params: seasonId, gameweekId, country, page (default 1), limit (default 50)
 */
async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const gameweekId = searchParams.get('gameweekId');
    const country = searchParams.get('country')?.trim().toUpperCase() || null;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10));

    const supabase = supabaseServer();
    let currentUserId: string | null = null;
    try {
      currentUserId = (await verifyAuth(request)).userId;
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'status' in error && error.status !== 401) {
        throw error;
      }
    }

    if (searchParams.get('currentUserOnly') === 'true') {
      const currentUserEntry = currentUserId
        ? await getCurrentUserLeaderboardEntry(supabase, currentUserId, { seasonId, gameweekId, country })
        : null;
      const result = NextResponse.json({ currentUserId, currentUserEntry });
      result.headers.set('Cache-Control', 'private, no-store');
      return result;
    }

    const cacheKey = `leaderboard:${searchParams.toString()}`;
    const cached = getCached<LeaderboardData>(cacheKey);
    let response = cached;
    if (!response) {
      response = await getLeaderboardData(supabase, { seasonId, gameweekId, country, page, limit });
      setCached(cacheKey, response, 60_000);
    }

    let leaderboard = response.leaderboard;
    if (currentUserId && !leaderboard.some((entry) => entry.fantasy_teams.user_id === currentUserId)) {
      const currentUserEntry = await getCurrentUserLeaderboardEntry(
        supabase,
        currentUserId,
        { seasonId, gameweekId, country },
      );
      if (currentUserEntry) {
        leaderboard = [...leaderboard, { ...currentUserEntry, is_pinned: true }];
      }
    }

    const result = NextResponse.json({ ...response, leaderboard, currentUserId });
    result.headers.set(
      'Cache-Control',
      currentUserId ? 'private, no-store' : 'public, s-maxage=60, stale-while-revalidate=30',
    );
    return result;
  } catch (error: unknown) {
    console.error('Error fetching leaderboard:', error);
    if (error instanceof LeaderboardDataError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export const GET = withApiTelemetry('GET', '/api/leaderboard', getHandler);
