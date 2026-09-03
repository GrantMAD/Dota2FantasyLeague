import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const supabase = supabaseServer();

    const { data, error } = await (supabase.from('users') as any)
      .select('id, username, display_name, avatar_url, bio, theme_preference, created_at, updated_at')
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
        country: null,
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
    const { userId } = await verifyAuth(request);
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

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No valid profile fields provided.' }, { status: 400 });
    }

    const { data, error } = await (supabase.from('users') as any)
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, username, display_name, avatar_url, bio, theme_preference, created_at, updated_at')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Unable to save profile.', details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      profile: {
        ...data,
        country: null,
        member_since: data?.created_at,
      },
    });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: 'Unable to save profile.' }, { status });
  }
}
