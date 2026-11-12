/**
 * Individual job cron endpoint.
 *
 * cron-jobs.org calls one URL per job, e.g. GET /api/cron/sync-players, so each
 * HTTP request runs exactly one job rather than stacking all due jobs sequentially
 * in a single request. This keeps every invocation well within Vercel's function
 * duration limits on the free Hobby plan.
 *
 * Authorization: the caller must supply the same Bearer token as the shared
 * /api/cron endpoint (CRON_SECRET environment variable).
 */

import { NextRequest, NextResponse } from 'next/server';
import { runJob, type JobRunOptions } from '@/lib/jobs/scheduler';
import { withApiTelemetry } from '@/lib/api-telemetry';

const VALID_JOB_NAMES = [
  'sync-players',
  'sync-teams',
  'discover-tournaments',
  'fetch-matches',
  'fetch-match-details',
  'track-roster-changes',
  'process-completed-matches',
  'calculate-fantasy-scores',
  'recalculate-gameweeks',
  'recalculate-leagues',
  'calculate-global-rankings',
  'update-player-prices',
  'send-deadline-notifications',
  'send-price-change-notifications',
  'send-rank-notifications',
  'send-unavailable-player-notifications',
  'process-push-receipts',
  'transition-gameweeks',
  'backfill-placeholder-players',
  'backfill-team-logos',
  'purge-inactive-data',
  'purge-interaction-telemetry',
  'auto-resolve-conflicts',
] as const;

type ValidJobName = (typeof VALID_JOB_NAMES)[number];

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

async function getHandler(
  request: NextRequest,
  { params }: { params: Promise<{ job: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid or missing CRON_SECRET' }, { status: 401 });
  }

  const { job } = await params;

  if (!VALID_JOB_NAMES.includes(job as ValidJobName)) {
    return NextResponse.json({ error: `Unknown job: ${job}` }, { status: 400 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const options: JobRunOptions = {};
    if (searchParams.has('batchSize')) options.batchSize = Number(searchParams.get('batchSize'));
    if (searchParams.has('processLimit')) options.processLimit = Number(searchParams.get('processLimit'));
    if (searchParams.has('matchLimit')) options.matchLimit = Number(searchParams.get('matchLimit'));
    if (searchParams.has('gameweekLimit')) options.gameweekLimit = Number(searchParams.get('gameweekLimit'));
    if (searchParams.has('tournamentLimit')) options.tournamentLimit = Number(searchParams.get('tournamentLimit'));
    if (searchParams.has('playerLimit')) options.playerLimit = Number(searchParams.get('playerLimit'));
    if (searchParams.has('seasonLimit')) options.seasonLimit = Number(searchParams.get('seasonLimit'));
    if (searchParams.has('teamLimit')) options.teamLimit = Number(searchParams.get('teamLimit'));
    if (searchParams.has('skipRosters')) options.skipRosters = searchParams.get('skipRosters') === 'true';

    const result = await runJob(job as ValidJobName, options);
    const success = result.status !== 'failed';
    return NextResponse.json({ success, result }, { status: success ? 200 : 500 });
  } catch (error) {
    console.error(`[Cron/${job}] Unhandled error:`, error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export const GET = withApiTelemetry('GET', '/api/cron/[job]', getHandler);

