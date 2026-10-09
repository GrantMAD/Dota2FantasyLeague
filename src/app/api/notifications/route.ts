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

const matchesCategory = (notification: NotificationRecord, category: NotificationCategory) => {
  if (category === 'all') return true;
  if (category === 'unread') return !notification.is_read;

  const categoryMap: Record<string, NotificationCategory> = {
    gameweek_deadline: 'deadline',
    lineup_deadline: 'deadline',
    deadline_reminder: 'deadline',
    deadline: 'deadline',
    price_change: 'market',
    transfer_market: 'market',
    wildcard_used: 'market',
    score_posted: 'scoring',
    gameweek_result: 'scoring',
    rank_movement: 'scoring',
    league_invite: 'league',
    league_activity: 'league',
    league_result: 'league',
    h2h_result: 'league',
  };

  return categoryMap[notification.type] === category;
};

async function getHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const { searchParams } = new URL(request.url);
    const category = (searchParams.get('category') ?? 'all') as NotificationCategory;
    const unreadOnly = searchParams.get('unreadOnly') === 'true' || category === 'unread';
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '30', 10));

    const supabase = supabaseServer();
    const query = supabase
      .from('user_notifications')
      .select('id, type, title, message, is_read, created_at, metadata')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

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

    const notifications = (notificationsResult.data ?? []).filter((notification) => {
      if (unreadOnly && notification.is_read) return false;
      return matchesCategory(notification as NotificationRecord, category);
    });

    const response = NextResponse.json({
      notifications,
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
