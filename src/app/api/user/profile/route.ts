import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';

type UserProfileRecord = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country_code: string | null;
  timezone: string | null;
  theme_preference: 'light' | 'dark';
  created_at: string;
  updated_at: string;
};

type UserQuery = {
  select: (columns: string) => UserQuery;
  update: (values: Record<string, string | null>) => UserQuery;
  eq: (column: string, value: string) => UserQuery;
  maybeSingle: () => Promise<{ data: UserProfileRecord | null; error: { message: string } | null }>;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const { userId } = auth;
    const supabase = supabaseServer();

    const users = supabase.from('users') as unknown as UserQuery;
    const { data, error } = await users
      .select('id, username, display_name, avatar_url, bio, country_code, timezone, theme_preference, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Unable to load profile.', details: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({
      profile: {
        ...data,
        email: auth.email,
        member_since: data.created_at,
      },
    });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 401;
    return NextResponse.json({ error: 'Unable to load profile.' }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const { userId } = auth;
    const body = await request.json();
    const supabase = supabaseServer();

    const payload: Record<string, string | null> = {};

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

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No valid profile fields provided.' }, { status: 400 });
    }

    const users = supabase.from('users') as unknown as UserQuery;
    const { data, error } = await users
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, username, display_name, avatar_url, bio, country_code, timezone, theme_preference, created_at, updated_at')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Unable to save profile.', details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      profile: {
        ...data,
        email: auth.email,
        member_since: data?.created_at,
      },
    });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: 'Unable to save profile.' }, { status });
  }
}
