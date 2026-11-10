import { NextRequest, NextResponse } from 'next/server';
import { applyRefreshedTokens, verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';

function getErrorStatus(error: unknown): number {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status: number }).status)
    : 500;
}

async function getHandler(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    auth = await verifyAuth(request);
    const { data, error } = await supabaseServer()
      .from('player_watchlist')
      .select('player_id')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Unable to load player watchlist: ${error.message}`);

    const response = NextResponse.json({
      playerIds: (data ?? []).map((row) => Number(row.player_id)),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
    applyRefreshedTokens(response, auth);
    return response;
  } catch (error: unknown) {
    const status = getErrorStatus(error);
    if (status >= 500) console.error('[PlayerWatchlist] Failed to load watchlist:', error);
    const response = NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to load player watchlist.',
    }, { status });
    if (auth) applyRefreshedTokens(response, auth);
    return response;
  }
}

async function postHandler(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    auth = await verifyAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object.' }, { status: 400 });
    }
    const playerId = (body as Record<string, unknown>).playerId;
    if (typeof playerId !== 'number' || !Number.isSafeInteger(playerId) || playerId <= 0) {
      return NextResponse.json({ error: 'A valid player ID is required.' }, { status: 400 });
    }

    const { error } = await supabaseServer()
      .from('player_watchlist')
      .upsert(
        { user_id: auth.userId, player_id: playerId },
        { onConflict: 'user_id,player_id', ignoreDuplicates: true },
      );
    if (error) {
      if (error.code === '23503') {
        return NextResponse.json({ error: 'The selected player no longer exists.' }, { status: 404 });
      }
      throw new Error(`Unable to save player to watchlist: ${error.message}`);
    }

    const response = NextResponse.json({ playerId, watchlisted: true });
    applyRefreshedTokens(response, auth);
    return response;
  } catch (error: unknown) {
    const status = getErrorStatus(error);
    if (status >= 500) console.error('[PlayerWatchlist] Failed to save player:', error);
    const response = NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to save player to watchlist.',
    }, { status });
    if (auth) applyRefreshedTokens(response, auth);
    return response;
  }
}

async function deleteHandler(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    auth = await verifyAuth(request);
    const rawPlayerId = request.nextUrl.searchParams.get('playerId');
    const playerId = rawPlayerId === null ? Number.NaN : Number(rawPlayerId);
    if (!Number.isSafeInteger(playerId) || playerId <= 0) {
      return NextResponse.json({ error: 'A valid player ID is required.' }, { status: 400 });
    }

    const { error } = await supabaseServer()
      .from('player_watchlist')
      .delete()
      .eq('user_id', auth.userId)
      .eq('player_id', playerId);
    if (error) throw new Error(`Unable to remove player from watchlist: ${error.message}`);

    const response = NextResponse.json({ playerId, watchlisted: false });
    applyRefreshedTokens(response, auth);
    return response;
  } catch (error: unknown) {
    const status = getErrorStatus(error);
    if (status >= 500) console.error('[PlayerWatchlist] Failed to remove player:', error);
    const response = NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to remove player from watchlist.',
    }, { status });
    if (auth) applyRefreshedTokens(response, auth);
    return response;
  }
}

export const GET = withApiTelemetry('GET', '/api/user/player-watchlist', getHandler);
export const POST = withApiTelemetry('POST', '/api/user/player-watchlist', postHandler);
export const DELETE = withApiTelemetry('DELETE', '/api/user/player-watchlist', deleteHandler);
