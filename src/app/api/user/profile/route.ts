import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, applyRefreshedTokens } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';


type UserProfileRecord = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country_code: string | null;
  timezone: string | null;
  theme_preference: 'light' | 'dark';
  email_notifications?: boolean | null;
  push_notifications?: boolean | null;
  role?: string | null;
  created_at: string;
  updated_at: string;
};

type UserQuery = {
  select: (columns: string) => UserQuery;
  update: (values: Record<string, string | boolean | null>) => UserQuery;
  eq: (column: string, value: string) => UserQuery;
  maybeSingle: () => Promise<{ data: UserProfileRecord | null; error: { message: string } | null }>;
};

type FantasySeasonRecord = {
  total_points: number | null;
  global_rank: number | null;
  fantasy_squads: { name: string | null } | { name: string | null }[] | null;
};

type FantasySeasonQuery = {
  select: (columns: string) => FantasySeasonQuery;
  eq: (column: string, value: string) => FantasySeasonQuery;
  maybeSingle: () => Promise<{ data: FantasySeasonRecord | null; error: { message: string } | null }>;
};

async function getHandler(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const { userId } = auth;
    const supabase = supabaseServer();

    const users = supabase.from('users') as unknown as UserQuery;
    const { data, error } = await users
      .select('id, username, display_name, avatar_url, bio, country_code, timezone, theme_preference, email_notifications, push_notifications, role, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Unable to load profile.', details: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ profile: null });
    }

    const fantasySeasons = supabase.from('fantasy_seasons') as unknown as FantasySeasonQuery;
    const { data: fantasySeason } = await fantasySeasons
      .select('id, total_points, global_rank, fantasy_squads(name)')
      .eq('user_id', userId)
      .maybeSingle();

    const fantasySquad = Array.isArray(fantasySeason?.fantasy_squads)
      ? fantasySeason.fantasy_squads[0]
      : fantasySeason?.fantasy_squads;

    const response = NextResponse.json({
      profile: {
        ...data,
        email_notifications: data.email_notifications ?? true,
        push_notifications: data.push_notifications ?? true,
        role: data.role || auth.role || 'user',
        email: auth.email,
        member_since: data.created_at,
        fantasy_team: fantasySeason
          ? {
              name: fantasySquad?.name || 'My Fantasy Squad',
              total_points: Number(fantasySeason.total_points ?? 0),
              global_rank: fantasySeason.global_rank ?? null,
            }
          : null,
      },
    });
    applyRefreshedTokens(response, auth);
    return response;
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 401;
    return NextResponse.json({ error: 'Unable to load profile.' }, { status });
  }
}

async function putHandler(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const { userId } = auth;
    const body = await request.json();
    const supabase = supabaseServer();

    const payload: Record<string, string | boolean | null> = {};

    if (typeof body.username === 'string') {
      const username = body.username.trim();
      if (username) payload.username = username;
    }

    if (typeof body.display_name === 'string') {
      const displayName = body.display_name.trim();
      payload.display_name = displayName || null;
    }

    if (typeof body.avatar_url === 'string') {
      const avatarUrl = body.avatar_url.trim();
      payload.avatar_url = avatarUrl || null;
    }

    if (typeof body.country_code === 'string') {
      const countryCode = body.country_code.trim().toUpperCase();
      payload.country_code = countryCode || null;
    }

    if (typeof body.timezone === 'string') {
      const timezone = body.timezone.trim();
      payload.timezone = timezone || null;
    }

    const emailNotifications = body.email_notifications ?? body.emailNotifications;
    if (typeof emailNotifications === 'boolean') {
      payload.email_notifications = emailNotifications;
    }

    const pushNotifications = body.push_notifications ?? body.pushNotifications;
    if (typeof pushNotifications === 'boolean') {
      payload.push_notifications = pushNotifications;
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No valid profile fields provided.' }, { status: 400 });
    }

    const users = supabase.from('users') as unknown as UserQuery;
    const { data, error } = await users
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, username, display_name, avatar_url, bio, country_code, timezone, theme_preference, email_notifications, push_notifications, created_at, updated_at')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Unable to save profile.', details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      profile: {
        ...data,
        email_notifications: data?.email_notifications ?? true,
        push_notifications: data?.push_notifications ?? true,
        email: auth.email,
        member_since: data?.created_at,
      },
    });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: 'Unable to save profile.' }, { status });
  }
}

export const GET = withApiTelemetry('GET', '/api/user/profile', getHandler);
export const PUT = withApiTelemetry('PUT', '/api/user/profile', putHandler);
