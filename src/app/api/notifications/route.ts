import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, applyRefreshedTokens, AuthError } from '@/lib/auth-utils';
import { withApiTelemetry } from '@/lib/api-telemetry';


interface NotificationRecord {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

type NotificationCategory = 'all' | 'unread' | 'deadline' | 'market' | 'scoring' | 'league';

const notificationTypesByCategory: Partial<Record<NotificationCategory, string[]>> = {
  deadline: ['gameweek_deadline', 'lineup_deadline', 'deadline_reminder', 'deadline'],
  market: ['price_change', 'transfer_market', 'wildcard_used', 'player_removed'],
  scoring: ['score_posted', 'gameweek_result', 'rank_movement', 'rank_update'],
  league: ['league_invite', 'league_activity', 'league_result', 'h2h_result'],
};

interface NotificationCursor {
  createdAt: string;
  id: number;
}

function decodeCursor(cursor: string): NotificationCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      createdAt?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.id !== 'number' ||
      !Number.isSafeInteger(parsed.id) ||
      parsed.id <= 0
    ) {
      return null;
    }
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt: createdAt.toISOString(), id: parsed.id };
  } catch {
    return null;
  }
}

function encodeCursor(notification: NotificationRecord): string {
  return Buffer.from(JSON.stringify({
    createdAt: new Date(notification.created_at).toISOString(),
    id: notification.id,
  })).toString('base64url');
}

async function getHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const { searchParams } = new URL(request.url);
    const rawCategory = searchParams.get('category') ?? 'all';
    const validCategories: NotificationCategory[] = ['all', 'unread', 'deadline', 'market', 'scoring', 'league'];
    if (!validCategories.includes(rawCategory as NotificationCategory)) {
      return NextResponse.json({ error: 'Invalid notification category.' }, { status: 400 });
    }
    const category = rawCategory as NotificationCategory;
    const unreadOnly = searchParams.get('unreadOnly') === 'true' || category === 'unread';
    const rawLimit = searchParams.get('limit') ?? '30';
    const parsedLimit = Number(rawLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return NextResponse.json({ error: 'Limit must be an integer between 1 and 100.' }, { status: 400 });
    }
    const limit = parsedLimit;
    const rawCursor = searchParams.get('cursor');
    const cursor = rawCursor ? decodeCursor(rawCursor) : null;
    if (rawCursor && !cursor) {
      return NextResponse.json({ error: 'Invalid notification cursor.' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const query = supabase
      .from('user_notifications')
      .select('id, type, title, message, is_read, created_at, metadata')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (unreadOnly) query.eq('is_read', false);
    if (notificationTypesByCategory[category]) {
      query.in('type', notificationTypesByCategory[category]);
    }
    if (cursor) {
      query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
    }
    query.limit(limit + 1);

    const [notificationsResult, unreadCountResult] = await Promise.all([
      query,
      supabase
        .from('user_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.userId)
        .eq('is_read', false),
    ]);

    if (notificationsResult.error || unreadCountResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch notifications.',
          details: notificationsResult.error?.message ?? unreadCountResult.error?.message,
        },
        { status: 500 }
      );
    }

    const rows = (notificationsResult.data ?? []) as NotificationRecord[];
    const hasMore = rows.length > limit;
    const notifications = hasMore ? rows.slice(0, limit) : rows;

    const response = NextResponse.json({
      notifications,
      nextCursor: hasMore ? encodeCursor(notifications[notifications.length - 1]) : null,
      unreadCount: unreadCountResult.count ?? 0,
    });
    applyRefreshedTokens(response, user);
    return response;
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

async function putHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const { error } = await supabaseServer()
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', user.userId)
      .eq('is_read', false);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to mark notifications as read.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Notifications marked as read.' });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

async function deleteHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const { error } = await supabaseServer()
      .from('user_notifications')
      .delete()
      .eq('user_id', user.userId)
      .eq('is_read', true);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to clear read notifications.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Read notifications cleared.' });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export const GET = withApiTelemetry('GET', '/api/notifications', getHandler);
export const PUT = withApiTelemetry('PUT', '/api/notifications', putHandler);
export const DELETE = withApiTelemetry('DELETE', '/api/notifications', deleteHandler);
