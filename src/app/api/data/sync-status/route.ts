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
import { getProviderConfigurationStatus } from '@/lib/data-providers/provider-config';
import { withApiTelemetry } from '@/lib/api-telemetry';


async function getHandler() {
  try {
    const statuses = getAllJobStatuses();
    const health = await healthCheck();
    const recentRuns = getJobHistory(undefined, 10);
    const monitoring = getMonitoringSummary();
    const providerConfiguration = getProviderConfigurationStatus();

    return Response.json({
      success: true,
      health,
      monitoring,
      providerConfiguration,
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

export const GET = withApiTelemetry('GET', '/api/data/sync-status', getHandler);
