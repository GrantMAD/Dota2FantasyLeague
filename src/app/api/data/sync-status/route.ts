/**
 * GET /api/data/sync-status
 * 
 * Get status of latest data sync jobs
 * Public endpoint (can add auth later)
 */

import {
  getAllJobStatuses,
  getJobHistory,
  getMonitoringSummary,
  healthCheck,
} from '@/lib/jobs/scheduler';

export async function GET() {
  try {
    const statuses = getAllJobStatuses();
    const health = await healthCheck();
    const recentRuns = getJobHistory(undefined, 10);
    const monitoring = getMonitoringSummary();

    return Response.json({
      success: true,
      health,
      monitoring,
      latestRuns: statuses,
      recentRuns,
      timestamp: new Date(),
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
