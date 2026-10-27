import { NextRequest, NextResponse } from 'next/server';
import { applyRefreshedTokens, verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';

const PAGE_SIZE = 20;

interface FeedCursor {
  updatedAt: string;
  activityId: string;
}

interface FeedRow {
  activity_id: string;
  activity_type: 'transfer' | 'chip' | 'lineup' | 'gameweek_score';
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  season_id: number;
  season_name: string;
  gameweek_id: number;
  gameweek_number: number | null;
  title: string;
  players_in: string[] | null;
  players_out: string[] | null;
  chip: string | null;
  gameweek_points: number | string | null;
  total_points: number | string | null;
  gameweek_rank: number | null;
  previous_gameweek_rank: number | null;
  global_rank: number | null;
  updated_at: string;
  lineup_changes: Array<{
    slot: string;
    from: string | null;
    to: string | null;
  }> | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unable to load friend activity.';
}

function decodeCursor(value: string | null): FeedCursor | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      typeof parsed !== 'object'
      || parsed === null
      || !('updatedAt' in parsed)
      || !('activityId' in parsed)
    ) return null;
    const cursor = parsed as { updatedAt: unknown; activityId: unknown };
    if (
      typeof cursor.updatedAt !== 'string'
      || Number.isNaN(Date.parse(cursor.updatedAt))
      || typeof cursor.activityId !== 'string'
      || !/^(audit|score):\d{20}$/.test(cursor.activityId)
    ) return null;
    return { updatedAt: cursor.updatedAt, activityId: cursor.activityId };
  } catch {
    return null;
  }
}

async function getHandler(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    auth = await verifyAuth(request);
    const cursorValue = new URL(request.url).searchParams.get('cursor');
    const cursor = decodeCursor(cursorValue);
    if (cursorValue && !cursor) {
      const response = NextResponse.json({ error: 'The feed cursor is invalid.' }, {
        status: 400,
        headers: { 'Cache-Control': 'private, no-store' },
      });
      applyRefreshedTokens(response, auth);
      return response;
    }

    const { data, error } = await supabaseServer().rpc('get_followed_activity_feed', {
      p_viewer_id: auth.userId,
      p_before: cursor?.updatedAt ?? null,
      p_before_id: cursor?.activityId ?? null,
      p_limit: PAGE_SIZE + 1,
    });
    if (error) throw new Error(`Unable to load friend activity: ${error.message}`);

    const rows = (data ?? []) as FeedRow[];
    const hasMore = rows.length > PAGE_SIZE;
    const activities = rows.slice(0, PAGE_SIZE);
    const lastActivity = activities.at(-1);
    const nextCursor = hasMore && lastActivity
      ? Buffer.from(JSON.stringify({
        updatedAt: lastActivity.updated_at,
        activityId: String(lastActivity.activity_id),
      })).toString('base64url')
      : null;

    const response = NextResponse.json({
      activities,
      nextCursor,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
    applyRefreshedTokens(response, auth);
    return response;
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: number }).status)
      : 500;
    if (status >= 500) console.error('[Friends] Failed to load activity feed:', error);
    const response = NextResponse.json({
      error: getErrorMessage(error),
    }, { status, headers: { 'Cache-Control': 'private, no-store' } });
    if (auth) applyRefreshedTokens(response, auth);
    return response;
  }
}

export const GET = withApiTelemetry('GET', '/api/friends/feed', getHandler);
