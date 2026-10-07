import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { isExpoPushToken } from '@/lib/push-notifications';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorStatus(error: unknown, fallback: number): number {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status: number }).status)
    : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 });
    }

    if (
      !isRecord(body) ||
      !isExpoPushToken(body.token) ||
      (body.platform !== 'ios' && body.platform !== 'android')
    ) {
      return NextResponse.json({ error: 'A valid Expo push token and mobile platform are required.' }, { status: 400 });
    }

    const tokenTable = supabaseServer().from('user_push_tokens');
    const { data: existingToken, error: lookupError } = await tokenTable
      .select('user_id')
      .eq('expo_push_token', body.token)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: 'Unable to register this device for push notifications.' }, { status: 500 });
    }
    if (existingToken && existingToken.user_id !== userId) {
      return NextResponse.json({ error: 'This device token is registered to another account. Sign out there first.' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const registration = {
      platform: body.platform,
      updated_at: now,
      last_seen_at: now,
    };
    if (existingToken) {
      const { error } = await tokenTable
        .update(registration)
        .eq('user_id', userId)
        .eq('expo_push_token', body.token);
      if (error) {
        return NextResponse.json({ error: 'Unable to refresh this device registration.' }, { status: 500 });
      }
    } else {
      const { error } = await tokenTable.insert({
        user_id: userId,
        expo_push_token: body.token,
        ...registration,
      });
      if (error?.code === '23505') {
        const { data: racedToken, error: raceLookupError } = await tokenTable
          .select('user_id')
          .eq('expo_push_token', body.token)
          .maybeSingle();
        if (raceLookupError) {
          return NextResponse.json({ error: 'Unable to register this device for push notifications.' }, { status: 500 });
        }
        if (racedToken?.user_id === userId) {
          const { error: updateError } = await tokenTable
            .update(registration)
            .eq('user_id', userId)
            .eq('expo_push_token', body.token);
          if (updateError) {
            return NextResponse.json({ error: 'Unable to refresh this device registration.' }, { status: 500 });
          }
          return NextResponse.json({ registered: true });
        }
        return NextResponse.json({ error: 'This device token is registered to another account. Sign out there first.' }, { status: 409 });
      }
      if (error) {
        return NextResponse.json({ error: 'Unable to register this device for push notifications.' }, { status: 500 });
      }
    }

    return NextResponse.json({ registered: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Unable to register this device for push notifications.' },
      { status: errorStatus(error, 401) },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 });
    }

    if (!isRecord(body) || !isExpoPushToken(body.token)) {
      return NextResponse.json({ error: 'A valid Expo push token is required.' }, { status: 400 });
    }

    const { error } = await supabaseServer()
      .from('user_push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('expo_push_token', body.token);

    if (error) {
      return NextResponse.json({ error: 'Unable to remove this device registration.' }, { status: 500 });
    }

    return NextResponse.json({ removed: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Unable to remove this device registration.' },
      { status: errorStatus(error, 401) },
    );
  }
}
