import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, AuthError } from '@/lib/auth-utils';

/**
 * GET /api/notifications
 * Returns the authenticated user's notifications, newest first.
 * Query params: unreadOnly (boolean), limit (default 30)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '30', 10));

    const supabase = supabaseServer();
    let query = (supabase.from('notifications') as any)
      .select('id, type, title, message, is_read, created_at, metadata')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) query = query.eq('is_read', false);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch notifications.', details: error.message },
        { status: 500 }
      );
    }

    const unreadCount = (data ?? []).filter((n: any) => !n.is_read).length;

    return NextResponse.json({ notifications: data ?? [], unreadCount });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
