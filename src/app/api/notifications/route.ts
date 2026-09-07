import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, AuthError } from '@/lib/auth-utils';

interface NotificationRecord {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const categoryOrder = ['all', 'unread', 'deadline', 'market', 'scoring', 'league'] as const;
type NotificationCategory = (typeof categoryOrder)[number];

const matchesCategory = (notification: NotificationRecord, category: NotificationCategory) => {
  if (category === 'all') return true;
  if (category === 'unread') return !notification.is_read;

  const categoryMap: Record<string, NotificationCategory> = {
    gameweek_deadline: 'deadline',
    lineup_deadline: 'deadline',
    deadline: 'deadline',
    price_change: 'market',
    transfer_market: 'market',
    wildcard_used: 'market',
    score_posted: 'scoring',
    gameweek_result: 'scoring',
    rank_movement: 'scoring',
    league_activity: 'league',
    league_result: 'league',
    h2h_result: 'league',
  };

  return categoryMap[notification.type] === category;
};

export async function GET(request: NextRequest) {
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

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch notifications.', details: error.message },
        { status: 500 }
      );
    }

    const notifications = (data ?? []).filter((notification) => {
      if (unreadOnly && notification.is_read) return false;
      return matchesCategory(notification as NotificationRecord, category);
    });

    const unreadCount = (data as NotificationRecord[] ?? []).filter((notification) => !notification.is_read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

export async function DELETE(request: NextRequest) {
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
