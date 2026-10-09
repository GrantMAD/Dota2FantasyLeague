import { after, NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { runJob } from '@/lib/jobs/scheduler';
import { withApiTelemetry } from '@/lib/api-telemetry';


const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const FINAL_MATCH_STATUSES = new Set(['completed', 'finished', 'ended', 'concluded']);

/**
 * POST /api/webhooks/match-result
 * Accepts a provider notification when one known match has concluded.
 *
 * Expected headers: x-webhook-secret: <secret>
 * Expected body: { matchId: number, status: string }
 */
async function postHandler(request: NextRequest) {
  const providedSecret = request.headers.get('x-webhook-secret');
  if (!WEBHOOK_SECRET || providedSecret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Request body must be an object.' }, { status: 400 });
  }

  const { matchId, status } = body as { matchId?: unknown; status?: unknown };
  if (!Number.isSafeInteger(matchId) || Number(matchId) <= 0) {
    return NextResponse.json({ error: 'matchId must be a positive integer.' }, { status: 400 });
  }
  if (typeof status !== 'string' || !FINAL_MATCH_STATUSES.has(status.toLowerCase())) {
    return NextResponse.json({ error: 'status must indicate that the match has concluded.' }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, detailed_stats_fetched_at')
    .eq('id', Number(matchId))
    .maybeSingle();

  if (matchError) {
    console.error('[Webhook] Failed to look up match:', matchError.message);
    return NextResponse.json({ error: 'Unable to verify match.' }, { status: 500 });
  }
  if (!match) {
    return NextResponse.json({ error: 'Match not found.' }, { status: 404 });
  }
  if (match.detailed_stats_fetched_at) {
    return NextResponse.json({ received: true, duplicate: true, matchId: match.id });
  }

  const { error: updateError } = await supabase
    .from('matches')
    .update({ status: 'completed' })
    .eq('id', match.id);

  if (updateError) {
    console.error('[Webhook] Failed to mark match completed:', updateError.message);
    return NextResponse.json({ error: 'Unable to queue match processing.' }, { status: 500 });
  }

  after(async () => {
    try {
      const result = await runJob('fetch-match-details', { matchId: match.id });
      if (result.status === 'failed') {
        console.error(`[Webhook] Targeted detail fetch failed for match ${match.id}:`, result.error);
      }
    } catch (error: unknown) {
      console.error(`[Webhook] Could not dispatch targeted detail fetch for match ${match.id}:`, error);
    }
  });

  return NextResponse.json({ received: true, queued: true, matchId: match.id }, { status: 202 });
}

export const POST = withApiTelemetry('POST', '/api/webhooks/match-result', postHandler);
