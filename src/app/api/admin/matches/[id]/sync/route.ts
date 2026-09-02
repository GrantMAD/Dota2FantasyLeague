import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAdminAuth, createErrorResponse } from '@/lib/auth-utils';
import { runJob } from '@/lib/jobs/scheduler';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdminAuth(request);

    const { id } = await params;
    const matchId = parseInt(id);

    if (isNaN(matchId)) {
      return NextResponse.json({ error: 'Invalid match ID' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Verify match exists
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id, status, external_match_id')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (match.status !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed matches can be re-synced' },
        { status: 400 }
      );
    }

    // Dispatch the fetch-match-details job asynchronously (fire and forget)
    // The job will pick up any matches missing detailed stats.
    // We also optimistically clear the detailed_stats_fetched_at flag so the job
    // re-processes this specific match.
    const { error: updateError } = await supabase
      .from('matches')
      .update({ detailed_stats_fetched_at: null })
      .eq('id', matchId);

    if (updateError) {
      console.warn(`Failed to clear stats flag for match ${matchId}:`, updateError.message);
    }

    // Trigger the job in background (don't await)
    runJob('fetch-match-details').catch(err =>
      console.error(`Background sync failed for match ${matchId}:`, err)
    );

    return NextResponse.json({
      success: true,
      message: `Match ${matchId} queued for re-sync. Stats will update shortly.`,
    });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}
