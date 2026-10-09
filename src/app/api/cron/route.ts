/**
 * Cron entry point for Vercel. Scheduled job definitions and UTC matching live
 * in the scheduler so deployment cadence and job cadence cannot drift apart.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAllJobs, runScheduledJobs } from '@/lib/jobs/scheduler';
import { withApiTelemetry } from '@/lib/api-telemetry';


function isAuthorizedCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`);
}

async function getHandler(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing CRON_SECRET' },
      { status: 401 }
    );
  }

  const now = new Date();
  try {
    const results = await runScheduledJobs(now);
    if (results.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No jobs scheduled for this time',
        timestamp: now,
      });
    }

    const success = results.every((result) => result.status !== 'failed');
    return NextResponse.json({
      success,
      message: `Processed ${results.length} scheduled jobs`,
      results,
      timestamp: now,
    }, { status: success ? 200 : 500 });
  } catch (error) {
    console.error('[Cron] Error executing scheduled jobs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: now,
      },
      { status: 500 }
    );
  }
}

/**
 * Alternative authenticated trigger for external job runners and testing.
 */
async function postHandler(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing CRON_SECRET' },
      { status: 401 }
    );
  }

  try {
    const results = await runAllJobs();
    const success = results.every((result) => result.status !== 'failed');
    return NextResponse.json({
      success,
      message: success ? 'All jobs completed successfully' : 'One or more jobs failed',
      results,
      timestamp: new Date(),
    }, { status: success ? 200 : 500 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }
}

export const GET = withApiTelemetry('GET', '/api/cron', getHandler);
export const POST = withApiTelemetry('POST', '/api/cron', postHandler);
