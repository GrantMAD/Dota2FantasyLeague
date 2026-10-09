import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';


// GET /api/user/tour-completions
// Returns completed page keys and dismissed page keys separately.
async function getHandler(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const { data, error } = await supabaseServer()
      .from('user_tour_completions')
      .select('page_key, dismissed')
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ error: 'Unable to load tour completions.' }, { status: 500 });
    }

    const rows = data ?? [];
    return NextResponse.json({
      completions: rows.map((r) => r.page_key),
      dismissed: rows.filter((r) => r.dismissed).map((r) => r.page_key),
    });
  } catch (error: unknown) {
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status: number }).status)
        : 401;
    if (status === 401) return NextResponse.json({ completions: [], dismissed: [] });
    return NextResponse.json({ error: 'Unable to load tour completions.' }, { status });
  }
}

// POST /api/user/tour-completions
// Body: { pageKey: string }
// Marks a tour as completed for the authenticated user. Idempotent (upsert).
async function postHandler(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const body = await request.json();
    const pageKey: string = body.pageKey;

    if (!pageKey || typeof pageKey !== 'string') {
      return NextResponse.json({ error: 'pageKey is required.' }, { status: 400 });
    }

    const { error } = await supabaseServer()
      .from('user_tour_completions')
      .upsert(
        { user_id: userId, page_key: pageKey, completed_at: new Date().toISOString() },
        { onConflict: 'user_id,page_key' },
      );

    if (error) {
      return NextResponse.json({ error: 'Unable to save tour completion.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status: number }).status)
        : 500;
    return NextResponse.json({ error: 'Unable to save tour completion.' }, { status });
  }
}

// PATCH /api/user/tour-completions
// Body: { pageKey: string }
// Marks the replay button as dismissed (hidden) for this page.
async function patchHandler(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const body = await request.json();
    const pageKey: string = body.pageKey;

    if (!pageKey || typeof pageKey !== 'string') {
      return NextResponse.json({ error: 'pageKey is required.' }, { status: 400 });
    }

    const { error } = await supabaseServer()
      .from('user_tour_completions')
      .update({ dismissed: true })
      .eq('user_id', userId)
      .eq('page_key', pageKey);

    if (error) {
      return NextResponse.json({ error: 'Unable to dismiss tour button.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status: number }).status)
        : 500;
    return NextResponse.json({ error: 'Unable to dismiss tour button.' }, { status });
  }
}

// DELETE /api/user/tour-completions
// Body: { pageKey: string }
// Resets a tour for a user (lets them replay from fresh state).
async function deleteHandler(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const body = await request.json();
    const pageKey: string = body.pageKey;

    if (!pageKey || typeof pageKey !== 'string') {
      return NextResponse.json({ error: 'pageKey is required.' }, { status: 400 });
    }

    const { error } = await supabaseServer()
      .from('user_tour_completions')
      .delete()
      .eq('user_id', userId)
      .eq('page_key', pageKey);

    if (error) {
      return NextResponse.json({ error: 'Unable to reset tour completion.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status: number }).status)
        : 500;
    return NextResponse.json({ error: 'Unable to reset tour completion.' }, { status });
  }
}

export const GET = withApiTelemetry('GET', '/api/user/tour-completions', getHandler);
export const POST = withApiTelemetry('POST', '/api/user/tour-completions', postHandler);
export const PATCH = withApiTelemetry('PATCH', '/api/user/tour-completions', patchHandler);
export const DELETE = withApiTelemetry('DELETE', '/api/user/tour-completions', deleteHandler);
