import { NextRequest, NextResponse } from 'next/server';
import { applyRefreshedTokens, verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';

const USER_FIELDS = 'id, username, display_name, avatar_url';
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function getErrorStatus(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = Number((error as { status: number }).status);
    if (Number.isInteger(status) && status >= 400 && status < 600) return status;
  }
  return 500;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function normalizeSearchQuery(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40);
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

async function getHandler(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    auth = await verifyAuth(request);
    const db = supabaseServer();
    const rawQuery = new URL(request.url).searchParams.get('q');

    if (rawQuery !== null) {
      const query = normalizeSearchQuery(rawQuery);
      if (query.replace(/\s/g, '').length < 2) {
        return responseWithAuth({ users: [] }, 200, auth);
      }

      const likePattern = `%${escapeLikePattern(query)}%`;
      const [usernameResult, displayNameResult] = await Promise.all([
        db.from('users')
          .select(USER_FIELDS)
          .neq('id', auth.userId)
          .ilike('username', likePattern)
          .order('username', { ascending: true })
          .limit(20),
        db.from('users')
          .select(USER_FIELDS)
          .neq('id', auth.userId)
          .ilike('display_name', likePattern)
          .order('username', { ascending: true })
          .limit(20),
      ]);
      if (usernameResult.error || displayNameResult.error) {
        throw new Error(`Unable to search for users: ${usernameResult.error?.message ?? displayNameResult.error?.message}`);
      }

      const matchingUsers = [...new Map(
        [...(usernameResult.data ?? []), ...(displayNameResult.data ?? [])]
          .map((user) => [user.id, user]),
      ).values()]
        .sort((left, right) => left.username.localeCompare(right.username))
        .slice(0, 20);
      const userIds = matchingUsers.map((user) => user.id);
      const { data: relationships, error: relationshipsError } = userIds.length
        ? await db.from('user_follows')
          .select('followed_id')
          .eq('follower_id', auth.userId)
          .in('followed_id', userIds)
        : { data: [], error: null };
      if (relationshipsError) {
        throw new Error(`Unable to check your following list: ${relationshipsError.message}`);
      }

      const followingIds = new Set((relationships ?? []).map((row) => row.followed_id));
      return responseWithAuth({
        users: matchingUsers.map((user) => ({
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          is_following: followingIds.has(user.id),
        })),
      }, 200, auth);
    }

    const relationships: Array<{ followed_id: string; created_at: string }> = [];
    for (let offset = 0; ; offset += 500) {
      const { data: page, error: relationshipsError } = await db
        .from('user_follows')
        .select('followed_id, created_at')
        .eq('follower_id', auth.userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + 499);
      if (relationshipsError) {
        throw new Error(`Unable to load your following list: ${relationshipsError.message}`);
      }
      relationships.push(...(page ?? []));
      if ((page ?? []).length < 500) break;
    }

    const followedIds = relationships.map((relationship) => relationship.followed_id);
    const users: Array<{
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    }> = [];
    for (let offset = 0; offset < followedIds.length; offset += 500) {
      const { data: profilePage, error: usersError } = await db.from('users')
        .select(USER_FIELDS)
        .in('id', followedIds.slice(offset, offset + 500));
      if (usersError) throw new Error(`Unable to load followed profiles: ${usersError.message}`);
      users.push(...(profilePage ?? []));
    }

    const profiles = new Map(users.map((user) => [user.id, user]));
    return responseWithAuth({
      following: relationships.flatMap((relationship) => {
        const user = profiles.get(relationship.followed_id);
        return user ? [{
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          followed_at: relationship.created_at,
        }] : [];
      }),
    }, 200, auth);
  } catch (error: unknown) {
    const status = getErrorStatus(error);
    if (status >= 500) console.error('[Friends] Failed to load friends:', error);
    const response = NextResponse.json({
      error: getErrorMessage(error, 'Unable to load friends.'),
    }, { status, headers: { 'Cache-Control': 'private, no-store' } });
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
      return responseWithAuth({ error: 'Request body must be valid JSON.' }, 400, auth);
    }

    const targetUserId = typeof body === 'object' && body !== null && 'userId' in body
      ? (body as { userId?: unknown }).userId
      : undefined;
    if (typeof targetUserId !== 'string' || !USER_ID_PATTERN.test(targetUserId)) {
      return responseWithAuth({ error: 'A valid user ID is required.' }, 400, auth);
    }
    if (targetUserId === auth.userId) {
      return responseWithAuth({ error: 'You cannot follow yourself.' }, 400, auth);
    }

    const { error } = await supabaseServer().from('user_follows').insert({
      follower_id: auth.userId,
      followed_id: targetUserId,
    });
    if (error?.code === '23503') {
      return responseWithAuth({ error: 'That user could not be found.' }, 404, auth);
    }
    if (error?.code === '23505') {
      return responseWithAuth({ error: 'You are already following this user.' }, 409, auth);
    }
    if (error) throw new Error(`Unable to follow this user: ${error.message}`);

    return responseWithAuth({ following: true }, 201, auth);
  } catch (error: unknown) {
    const status = getErrorStatus(error);
    if (status >= 500) console.error('[Friends] Failed to follow user:', error);
    const response = NextResponse.json({
      error: getErrorMessage(error, 'Unable to follow this user.'),
    }, { status, headers: { 'Cache-Control': 'private, no-store' } });
    if (auth) applyRefreshedTokens(response, auth);
    return response;
  }
}

async function deleteHandler(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    auth = await verifyAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return responseWithAuth({ error: 'Request body must be valid JSON.' }, 400, auth);
    }

    const targetUserId = typeof body === 'object' && body !== null && 'userId' in body
      ? (body as { userId?: unknown }).userId
      : undefined;
    if (typeof targetUserId !== 'string' || !USER_ID_PATTERN.test(targetUserId)) {
      return responseWithAuth({ error: 'A valid user ID is required.' }, 400, auth);
    }

    const { error } = await supabaseServer().from('user_follows')
      .delete()
      .eq('follower_id', auth.userId)
      .eq('followed_id', targetUserId);
    if (error) throw new Error(`Unable to unfollow this user: ${error.message}`);

    return responseWithAuth({ following: false }, 200, auth);
  } catch (error: unknown) {
    const status = getErrorStatus(error);
    if (status >= 500) console.error('[Friends] Failed to unfollow user:', error);
    const response = NextResponse.json({
      error: getErrorMessage(error, 'Unable to unfollow this user.'),
    }, { status, headers: { 'Cache-Control': 'private, no-store' } });
    if (auth) applyRefreshedTokens(response, auth);
    return response;
  }
}

export const GET = withApiTelemetry('GET', '/api/friends', getHandler);
export const POST = withApiTelemetry('POST', '/api/friends', postHandler);
export const DELETE = withApiTelemetry('DELETE', '/api/friends', deleteHandler);
