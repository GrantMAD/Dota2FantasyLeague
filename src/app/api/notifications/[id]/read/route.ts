import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, AuthError } from '@/lib/auth-utils';

interface RouteContext {
  params: { id: string };
}

/**
 * PUT /api/notifications/[id]/read
 * Marks a single notification as read for the authenticated user.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await verifyAuth(request);

    const notificationId = parseInt(context.params.id, 10);
    if (isNaN(notificationId)) {
      return NextResponse.json({ error: 'Invalid notification ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data, error } = await (supabase
      .from('notifications') as any)
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', user.userId) // Ensure users can only mark their own notifications
      .select('id, is_read')
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to mark notification as read.', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Notification not found or does not belong to you.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Notification marked as read.', notification: data });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
