import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import { verifyAdminAuth, createErrorResponse } from '@/lib/auth-utils';
import { logAuditAction } from '@/lib/audit-logger';
import { withApiTelemetry } from '@/lib/api-telemetry';

interface PatchBody {
  status?: 'completed' | 'cancelled' | 'postponed';
  best_of?: 1 | 2 | 3 | 5;
}

async function patchHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await verifyAdminAuth(request);
    const { id } = await params;
    const matchId = parseInt(id);

    if (isNaN(matchId)) {
      return NextResponse.json({ error: 'Invalid match ID' }, { status: 400 });
    }

    const body = (await request.json()) as PatchBody;
    const { status, best_of } = body;

    const VALID_STATUSES = new Set(['completed', 'cancelled', 'postponed']);
    const VALID_BEST_OF = new Set([1, 2, 3, 5]);

    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `Invalid status "${status}". Allowed: completed, cancelled, postponed` },
        { status: 400 }
      );
    }
    if (best_of !== undefined && !VALID_BEST_OF.has(best_of)) {
      return NextResponse.json(
        { error: `Invalid best_of "${best_of}". Allowed: 1, 2, 3, 5` },
        { status: 400 }
      );
    }
    if (!status && best_of === undefined) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    // Fetch current match state
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id, status, series_id')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Update match status if requested
    if (status) {
      const { error: updateError } = await supabase
        .from('matches')
        .update({ status, last_synced_at: new Date().toISOString() })
        .eq('id', matchId);

      if (updateError) {
        return NextResponse.json(
          { error: `Failed to update match status: ${updateError.message}` },
          { status: 500 }
        );
      }

      await logAuditAction({
        tableName: 'matches',
        recordId: matchId,
        action: 'UPDATE',
        changedBy: adminId,
        oldValues: { status: match.status },
        newValues: { status },
        reason: `Admin force-set match status to ${status}`,
      });
    }

    // Update series best_of if requested
    if (best_of !== undefined && match.series_id) {
      const { data: series, error: seriesReadError } = await supabase
        .from('tournament_series')
        .select('id, best_of')
        .eq('id', match.series_id)
        .single();

      if (seriesReadError || !series) {
        return NextResponse.json({ error: 'Series not found for this match' }, { status: 404 });
      }

      const { error: seriesUpdateError } = await supabase
        .from('tournament_series')
        .update({ best_of })
        .eq('id', match.series_id);

      if (seriesUpdateError) {
        return NextResponse.json(
          { error: `Failed to update series best_of: ${seriesUpdateError.message}` },
          { status: 500 }
        );
      }

      await logAuditAction({
        tableName: 'tournament_series',
        recordId: match.series_id,
        action: 'UPDATE',
        changedBy: adminId,
        oldValues: { best_of: series.best_of },
        newValues: { best_of },
        reason: `Admin corrected series best_of via match ${matchId}`,
      });
    }

    return NextResponse.json({ success: true, matchId, updated: { status, best_of } });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}

export const PATCH = withApiTelemetry('PATCH', '/api/admin/matches/:id', patchHandler);
